import "reflect-metadata";

var util = require('util');

const serializable_key = Symbol('yaserializer.serializable');
const unserializable_key = Symbol('yaserializer.unserializable');
const deserialize_action_key = Symbol('cereralizer.deserialize_action');
const serializer_key = Symbol('yaserializer.serializer');
const deserializer_key = Symbol('yaserializer.deserializer');

const registrations = Object.create(null);
registrations.___ = undefined;
delete registrations.___;

class serialization_context {
	invocation_options         ?: options;
	destructured_table          : any[];
	structured_table            : any[];
	string_table                : string[];
	post_deserialization_actions: (() => any)[];

	constructor(options?: options) {
		this.invocation_options = options;
		this.destructured_table = [];
		this.structured_table = [];
		this.string_table = [];
		this.post_deserialization_actions = [];
	}

	find_object_index(obj: any): number {
		return this.structured_table.indexOf(obj);
	}
	
	find_string_index(classname: string) : number {
		let idx = this.string_table.indexOf(classname);
		if(idx === -1) {
			idx = this.string_table.length;
			this.string_table.push(classname);
		}
		return idx
	}

	get_next_index(obj: any, destructured: any): number {
		let idx = this.structured_table.length;
		this.structured_table.push(obj);
		this.destructured_table.push(destructured);
		return idx;
	}
}

class placeholder {
	idx: number;
	ctxt: serialization_context;

	constructor(idx: number, ctxt: serialization_context) {
		this.idx = idx;
		this.ctxt = ctxt;
	}

	static try_snap(obj: any, deferred_snap?: (result: any) => void) : any {
		if(obj instanceof placeholder) {
			return obj.snap(deferred_snap);
		} else {
			if(deferred_snap) {
				return deferred_snap(obj);
			} else {
				return obj;
			}
		}
	}

	snap(deferred_snap?: (result: any) => any) : any {
		if(this.ctxt.structured_table[this.idx] !== this) {
			return this.ctxt.structured_table[this.idx];
		} else {
			if(deferred_snap) {
				const self = this;
				const bound_snap = function() {
					return deferred_snap!(self);
				};
				this.ctxt.post_deserialization_actions = [bound_snap].concat(this.ctxt.post_deserialization_actions);
				return this;
			}
			throw new Error('unresolved placeholder with no deferred action');
		}
	}
}

type label = (string | number | symbol);
type ignore_rule = label | RegExp;

interface options {
	ignore             ?: ignore_rule[];
	use_packed_format  ?: boolean;
	on_deserialize     ?: (obj: any) => any;
	on_post_deserialize?: (obj: any) => any;
	perform_encode     ?: (obj: any) => any;
	perform_decode     ?: (obj: any) => any;
}

class base_class_builder {
	serialize  : (obj: any, ctxt: serialization_context, reg: registration) => any;
	deserialize: (obj: any, ctxt: serialization_context, reg: registration) => any;

	constructor(serialize  : (obj: any, ctxt: serialization_context, reg: registration) => any,
	            deserialize: (obj: any, ctxt: serialization_context, reg: registration) => any) {
		this.serialize = serialize;
		this.deserialize = deserialize;
	}
}

interface arbitrary_ctor { 
	new(...args: any[]): any;
}

class registration {
	clazz: arbitrary_ctor;
	base : arbitrary_ctor;
	builder: base_class_builder;
	serialize_func?: (structured: any, serialize: (structured: any) => any) => [any, boolean];
	deserialize_func?: (structured: any, destructured: any, deserialize: (destructured: any) => any) => boolean;
	class_options?: options;

	constructor(clazz: arbitrary_ctor,
	            base: arbitrary_ctor,
	            builder: base_class_builder,
	            srlz?: (structured: any) => [any, boolean],
	            dsrlz?: (structured: any, destructured: any) => boolean,
	            class_options?: options) {
		this.clazz = clazz;
		this.base = base;
		this.builder = builder;
		this.serialize_func = srlz;
		this.deserialize_func = dsrlz;
		this.class_options = class_options;
	}
}

type TypedArray = Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array | BigInt64Array | BigUint64Array;

enum primitive_type {
	object = 0,
	string = 1,
	positive_integer = 2,
	negative_integer = 3,
	other_number = 4,
	boolean = 5,
	bigint = 6,
	symbol = 7,
	special = 8
}

enum special_type {
	undefined = 0,
	null = 1,
	nan = 2,
	plus_infinity = 3,
	minus_infinity = 4,
	minus_zero = 5,
}

class yaserializer {
	static typed_array_types = [
		Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array, BigInt64Array, BigUint64Array
	];

	static special_classes = [
		Array, ArrayBuffer, DataView, Function, Date, Map, Set, Error, RegExp, Number, Boolean, String, Symbol
	];

	static potential_base_classes = Array.prototype.concat(yaserializer.typed_array_types, yaserializer.special_classes);

	private base_class_builders: Map<arbitrary_ctor, base_class_builder>;
	private known_classes: Map<string, registration>;
	private global_options?: options;

	constructor(known_classes?: arbitrary_ctor[], options?: options) {
		this.known_classes = new Map<string, registration>();
		this.base_class_builders = new Map<arbitrary_ctor, base_class_builder>();

		this.base_class_builders.set(Object            , new base_class_builder(this.serialize_object_like      .bind(this) , this.deserialize_object_like      .bind(this)));
		this.base_class_builders.set(Function          , new base_class_builder(this.serialize_function_like    .bind(this) , this.deserialize_function_like    .bind(this)));
		this.base_class_builders.set(Array             , new base_class_builder(this.serialize_array_like       .bind(this) , this.deserialize_array_like       .bind(this)));
		this.base_class_builders.set(Boolean           , new base_class_builder(this.serialize_boolean_like     .bind(this) , this.deserialize_boolean_like     .bind(this)));
		this.base_class_builders.set(Number            , new base_class_builder(this.serialize_number_like      .bind(this) , this.deserialize_number_like      .bind(this)));
		this.base_class_builders.set(String            , new base_class_builder(this.serialize_string_like      .bind(this) , this.deserialize_string_like      .bind(this)));
		this.base_class_builders.set(RegExp            , new base_class_builder(this.serialize_regexp_like      .bind(this) , this.deserialize_regexp_like      .bind(this)));
		this.base_class_builders.set(Date              , new base_class_builder(this.serialize_date_like        .bind(this) , this.deserialize_date_like        .bind(this)));
		this.base_class_builders.set(Error             , new base_class_builder(this.serialize_error_like       .bind(this) , this.deserialize_error_like       .bind(this)));
		this.base_class_builders.set(Map               , new base_class_builder(this.serialize_map_like         .bind(this) , this.deserialize_map_like         .bind(this)));
		this.base_class_builders.set(Set               , new base_class_builder(this.serialize_set_like         .bind(this) , this.deserialize_set_like         .bind(this)));
		this.base_class_builders.set(ArrayBuffer       , new base_class_builder(this.serialize_array_buffer_like.bind(this) , this.deserialize_array_buffer_like.bind(this)));
		this.base_class_builders.set(DataView          , new base_class_builder(this.serialize_data_view_like   .bind(this) , this.deserialize_data_view_like   .bind(this)));
		this.base_class_builders.set(Int8Array         , new base_class_builder(this.serialize_typed_array_like .bind(this) , this.deserialize_typed_array_like .bind(this)));
		this.base_class_builders.set(Uint8Array        , new base_class_builder(this.serialize_typed_array_like .bind(this) , this.deserialize_typed_array_like .bind(this)));
		this.base_class_builders.set(Uint8ClampedArray , new base_class_builder(this.serialize_typed_array_like .bind(this) , this.deserialize_typed_array_like .bind(this)));
		this.base_class_builders.set(Int16Array        , new base_class_builder(this.serialize_typed_array_like .bind(this) , this.deserialize_typed_array_like .bind(this)));
		this.base_class_builders.set(Int32Array        , new base_class_builder(this.serialize_typed_array_like .bind(this) , this.deserialize_typed_array_like .bind(this)));
		this.base_class_builders.set(Uint16Array       , new base_class_builder(this.serialize_typed_array_like .bind(this) , this.deserialize_typed_array_like .bind(this)));
		this.base_class_builders.set(Uint32Array       , new base_class_builder(this.serialize_typed_array_like .bind(this) , this.deserialize_typed_array_like .bind(this)));
		this.base_class_builders.set(Float32Array      , new base_class_builder(this.serialize_typed_array_like .bind(this) , this.deserialize_typed_array_like .bind(this)));
		this.base_class_builders.set(Float64Array      , new base_class_builder(this.serialize_typed_array_like .bind(this) , this.deserialize_typed_array_like .bind(this)));
		this.base_class_builders.set(BigInt64Array     , new base_class_builder(this.serialize_typed_array_like .bind(this) , this.deserialize_typed_array_like .bind(this)));
		this.base_class_builders.set(BigUint64Array    , new base_class_builder(this.serialize_typed_array_like .bind(this) , this.deserialize_typed_array_like .bind(this)));
		
		const generator_function       = eval('(      function*() { yield 0; })'); // I can't directly access these types
		const async_function           = eval('(async function () {          })'); // and I need to protect them from TypeScript
		const async_generator_function = eval('(async function*() { yield 0; })'); // when targetting older than es2019.

		this.make_class_serializable(Object           );
		this.make_class_serializable(Function         );
		this.make_class_serializable(generator_function      .constructor as arbitrary_ctor); // but I can work around it
		this.make_class_serializable(async_function          .constructor as arbitrary_ctor);
		this.make_class_serializable(async_generator_function.constructor as arbitrary_ctor);
		this.make_class_serializable(Array            );
		this.make_class_serializable(ArrayBuffer      );
		this.make_class_serializable(DataView         );
		this.make_class_serializable(Boolean          );
		this.make_class_serializable(Number           );
		this.make_class_serializable(String           );
		this.make_class_serializable(RegExp           );
		this.make_class_serializable(Date             );
		this.make_class_serializable(Map              );
		this.make_class_serializable(Set              );
		this.make_class_serializable(Error            );
		this.make_class_serializable(EvalError        );
		this.make_class_serializable(RangeError       );
		this.make_class_serializable(ReferenceError   );
		this.make_class_serializable(SyntaxError      );
		this.make_class_serializable(TypeError        );
		this.make_class_serializable(URIError         );
		this.make_class_serializable(Int8Array        );
		this.make_class_serializable(Uint8Array       );
		this.make_class_serializable(Uint8ClampedArray);
		this.make_class_serializable(Int16Array       );
		this.make_class_serializable(Int32Array       );
		this.make_class_serializable(Uint16Array      );
		this.make_class_serializable(Uint32Array      );
		this.make_class_serializable(Float32Array     );
		this.make_class_serializable(Float64Array     );
		this.make_class_serializable(BigInt64Array    );
		this.make_class_serializable(BigUint64Array   );
		
		const null_proto : any = {};
		Object.setPrototypeOf(null_proto, null);
		null_proto.name = '';
		this.make_class_serializable(null_proto);

		if(known_classes) {
			known_classes.map((clazz: arbitrary_ctor) => {
				this.make_class_serializable(clazz);
			});
		}

		if(options) {
			this.global_options = {};
			Object.assign(this.global_options, options);
		}
	}

	private is_base_of(potential_base: any, potential_derived: any) {
		return potential_base == potential_derived || potential_base.isPrototypeOf(potential_derived);
	}

	// this returns one of the "special" base classes that Object.prototype.toString distinguishes between,
	// or that are otherwise annoying to work with (e.g. ArrayBuffer, Map) due to having fully private 
	// internal state.
	// I have to do it this way because the internal property [[Class]] is unmodifiable. Most other things 
	// that matter can just be overwritten.
	private get_true_base(clazz: any) : any {
		for(let base of yaserializer.potential_base_classes) {
			if(this.is_base_of(base, clazz)) {
				return base;
			}
		}
		return Object;
	}

	make_class_serializable(clazz: arbitrary_ctor,
	                        options?: options,
	                        srlz?: (structured: any) => [any, boolean],
	                        dsrlz?: (structured: any, destructured: any) => boolean) {
		if(!this.known_classes.has(clazz.name)) {
			const base = this.get_true_base(clazz);
			const builder = this.base_class_builders.get(base);
			if(!builder) {
				throw new Error(`I don't now how to construct objects with a base class of ${base}`);
			}
			if(srlz && !dsrlz) {
				throw new Error(`a custom serialization function must be paired with a deserialization function`);
			}
			if(!srlz && dsrlz) {
				throw new Error(`a custom deserialization function must be paired with a serialization function`);
			}
			this.known_classes.set(clazz.name, new registration(clazz, base, builder, srlz, dsrlz, options));
		}
	}

	private get_object_class_name(obj: any): string {
		if(obj.constructor && obj.constructor.name) {
			return obj.constructor.name;
		}
		if(obj.prototype === undefined) {
			return '';
		}
		throw new Error(`unknown class name for ${util.inspect(obj)}`);
	}

	private serialize_bigint(obj: bigint, ctxt: serialization_context) : any {
		return this.serialize_primitive(obj.toString(), ctxt);
	}

	private deserialize_bigint(obj: any, ctxt: serialization_context) : bigint {
		return BigInt(this.deserialize_primitive(obj, ctxt));
	}

	private serialize_symbol(obj: symbol, ctxt: serialization_context): any {
		const desc = obj.description;
		if(/^Symbol\./.test(desc)) {
			return [ 0, this.serialize_primitive(desc.replace(/^Symbol\./, ''), ctxt) ];
		}
		const key = Symbol.keyFor(obj);
		if(key !== undefined) {
			return [ 1, this.serialize_primitive(key, ctxt) ];
		}
		throw new Error(`can't serialize local Symbol`);
	}

	private deserialize_symbol(obj: any, ctxt: serialization_context): symbol {
		if(obj[0] === 0) {
			const desc : string = this.deserialize_primitive(obj[1], ctxt);
			// @ts-ignore
			return Symbol[desc] as symbol;
		} else if(obj[0] === 1) {
			return Symbol.for(this.deserialize_primitive(obj[1], ctxt));
		}
		throw new Error(`unknown Symbol type`);
	}

	private serialize_object_like(structured: Object, ctxt: serialization_context, reg: registration): any {
		return [];
	}

	private deserialize_object_like(structured: any, ctxt: serialization_context, reg: registration): object {
		return new Object();
	}

	private serialize_error_like(structured: Error, ctxt: serialization_context, reg: registration): any {
		return [];
	}

	private deserialize_error_like(structured: any, ctxt: serialization_context, reg: registration): Error {
		return new Error();
	}

	private serialize_typed_array_like(structured: TypedArray, ctxt: serialization_context, reg: registration) {
		return this.serialize_primitive(Buffer.from(structured.buffer).toString('base64'), ctxt);
	}

	private deserialize_typed_array_like(destructured: any, ctxt: serialization_context, reg: registration): TypedArray {
		const buff = Buffer.from(this.deserialize_primitive(destructured, ctxt), "base64");
		const byte_array = new Uint8Array(buff).buffer;
		return new reg.base(byte_array);
	}

	private serialize_regexp_like(structured: RegExp, ctxt: serialization_context, reg: registration): any {
		return this.serialize_primitive(structured.toString(), ctxt);
	}

	private deserialize_regexp_like(destructured: any, ctxt: serialization_context, reg: registration): RegExp {
		let str = this.deserialize_primitive(destructured, ctxt) as string;
		return new RegExp(str.substring(str.indexOf('/') + 1, str.lastIndexOf('/')), str.substring(str.lastIndexOf('/') + 1));
	}

	private serialize_boolean_like(structured: Boolean, ctxt: serialization_context, reg: registration): any {
		return structured.valueOf() ? 1 : 0;
	}

	private deserialize_boolean_like(destructured: any, ctxt: serialization_context, reg: registration): Boolean {
		if(!!destructured) {
			return new Boolean(true);
		} else {
			return new Boolean(false);
		}
	}

	private serialize_number_like(structured: Number, ctxt: serialization_context, reg: registration): any {
		return this.serialize_primitive(structured.valueOf().toString(), ctxt);
	}

	private deserialize_number_like(destructured: any, ctxt: serialization_context, reg: registration): Number {
		return new Number(this.deserialize_primitive(destructured, ctxt));
	}

	private serialize_date_like(structured: Date, ctxt: serialization_context, reg: registration): any {
		return this.serialize_primitive(structured.valueOf(), ctxt);
	}

	private deserialize_date_like(destructured: any, ctxt: serialization_context, reg: registration): Date {
		return new Date(this.deserialize_primitive(destructured, ctxt));
	}

	private serialize_string_like(structured: String, ctxt: serialization_context, reg: registration) : any {
		return this.serialize_primitive(structured.toString(), ctxt);
	}

	private deserialize_string_like(destructured: any, ctxt: serialization_context, reg: registration) : String {
		return new String(this.deserialize_primitive(destructured, ctxt));
	}

	private to_uint_32(n: number) : number {
		return n >>> 0;
	}

	private is_array_index(id: (string | symbol)): boolean {
		if(typeof id === "symbol") {
			return false;
		}
		// I don't make the rules
		const id_as_uint32 = this.to_uint_32(Number(id));
		return (String(id_as_uint32) === id) && (id_as_uint32 !== 4294967295)
	}

	private serialize_array_like(structured: Array<any>, ctxt: serialization_context, reg: registration) : any {
		let destructured = [] as any[];
		structured.forEach((value: any, idx: number) => {
			destructured.push(idx);
			destructured.push(this.serialize_primitive(value, ctxt));
		});
		return destructured;
	}

	private deserialize_array_like(destructured: any, ctxt: serialization_context, reg: registration) : Array<any> {
		return (destructured as any[]).reduce<any[]>((result: any[], value: any, index: number, array: any[]) => {
			if(index % 2 == 0) {
				const [idx, elem] = array.slice(index, index + 2);
				placeholder.try_snap(this.deserialize_primitive(elem, ctxt), (self: any) => {
					result[this.to_uint_32(Number(idx))] = placeholder.try_snap(self);
				});
			}
			return result;
		}, []);
	}

	private serialize_map_like(structured: Map<any, any>, ctxt: serialization_context, reg: registration) : any {
		let destructured = [] as any[];
		structured.forEach((value: any, key: any) => {
			destructured.push(this.serialize_primitive(key, ctxt));
			destructured.push(this.serialize_primitive(value, ctxt));
		});
		return destructured;
	}

	private deserialize_map_like(destructured: any, ctxt: serialization_context, reg: registration) : Map<any, any> {
		return (destructured as any[]).reduce<Map<any, any>>((result: Map<any, any>, value: any, index: number, array: any[]) => {
			if(index % 2 == 0) {
				const [key, value] = array.slice(index, index + 2);
				placeholder.try_snap(this.deserialize_primitive(key, ctxt), (k: any) => {
					placeholder.try_snap(this.deserialize_primitive(value, ctxt), (v: any) => {
						result.set(k, v);
					});
				});
			}
			return result;
		}, new Map<any, any>());
	}

	private serialize_set_like(structured: Set<any>, ctxt: serialization_context, reg: registration) : any {
		let destructured = [] as any[];
		structured.forEach((value: any) => {
			destructured.push(this.serialize_primitive(value, ctxt));
		});
		return destructured;
	}

	private deserialize_set_like(destructured: any, ctxt: serialization_context, reg: registration) : Set<any> {
		let structured = new Set<any>();
		destructured.forEach((value: any) => {
			placeholder.try_snap(this.deserialize_primitive(value, ctxt), (v: any) => {
				structured.add(v);
			});
		});
		return structured;
	}
	
	static regexp_specials = /[\\^$.*+?()[\]{}|]/g;
	static is_native_re = RegExp(`^${Function.prototype.toString.call(Object.prototype.hasOwnProperty).replace(yaserializer.regexp_specials, '\\$&').replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?')}$`);

	private serialize_function_like(structured: Function, ctxt: serialization_context, reg: registration): any {
		if(!yaserializer.is_native_re.test(structured.toString())) {
			return [this.serialize_primitive(structured.name, ctxt), this.serialize_primitive(structured.toString(), ctxt), this.serialize_primitive(!Object.prototype.hasOwnProperty.call(structured, 'caller'), ctxt) ];
		} else {
			throw new Error(`can't serialize native functions`);
		}
	}

	private deserialize_function_like(destructured: any, ctxt: serialization_context, reg: registration): Function {
		// there must be a better way, surely...
		const raw_name = this.deserialize_primitive(destructured[0], ctxt);
		const raw_body = this.deserialize_primitive(destructured[1], ctxt);
		const strict_environment = this.deserialize_primitive(destructured[2], ctxt);
		const prelude = strict_environment ? `'use strict'; ` : '';
		// TODO is there an elegant way to retrieve the real (caller's) name from here,
		// as that doesn't get flattened into a string
		if(!raw_name.match(/Symbol\..*/)
		&& !raw_name.match(/get .*/)
		&& !raw_name.match(/set .*/)) {
			const name = raw_name && raw_name !== 'anonymous' ? `const ${raw_name} = ` : '(';
			const body = raw_body;
			const tail = raw_name && raw_name !== 'anonymous' ? `; ${raw_name};` : ')';
			return (1, eval)(prelude + name + body + tail) as Function;
		}
		// funny names, e.g. getters' "get propertyname" or Symbols need special/annoying handling
		let function_decl = ' ';
		switch(reg.clazz.name) {
		case 'Function':
			function_decl = ' ';
			break;
		case 'AsyncFunction':
			function_decl = 'async  ';
			break;
		case 'GeneratorFunction':
			function_decl = '* ';
			break;
		case 'AsyncGeneratorFunction':
			function_decl = 'async * ';
		}
		let processed_body = raw_body.replace(/get /, '').replace(/set /, '').replace(/async /, '').trim().replace(/^\*/, '').trim().replace(/^\[[^]+\]/, '').replace(/^[^(]*/, '');
		const head = 'const x = { ';
		const body = processed_body;
		const tail = `}; x;`;
		
		const cooked_name = raw_name.match(/.*\[Symbol\..*\]/) ? raw_name
		                  : raw_name.match(/.*\[.*\]/)         ? '[Symbol.for("' + raw_name.substring(raw_name.indexOf('[') + 1, raw_name.indexOf(']')) + '")]'
		                  :                                      raw_name;
		// eval in global scope
		const obj = (1, eval)(prelude + head + function_decl + cooked_name + body + tail) as Function;
		Object.setPrototypeOf(obj, null);
		const descs = Object.getOwnPropertyDescriptors(obj);
		const keys = Array.prototype.concat(Object.getOwnPropertyNames(descs), Object.getOwnPropertySymbols(descs));
		const key = keys[0];
		const desc = descs[key];
		if(Object.prototype.hasOwnProperty.call(desc, 'get')) {
			return desc['get'] as Function;
		} else if(Object.prototype.hasOwnProperty.call(desc, 'set')) {
			return desc['set'] as Function;
		} else {
			return desc['value'] as Function;
		}
	}

	private serialize_array_buffer_like(structured: ArrayBuffer, ctxt: serialization_context, reg: registration) : any {
		return this.serialize_primitive(Buffer.from(structured as ArrayBuffer).toString('base64'), ctxt);
	}

	private deserialize_array_buffer_like(destructured: any, ctxt: serialization_context, reg: registration) : ArrayBuffer {
		return new Uint8Array(Buffer.from(this.deserialize_primitive(destructured, ctxt), 'base64')).buffer;
	}

	private serialize_data_view_like(structured: DataView, ctxt: serialization_context, reg: registration) : any {
		const buff = this.serialize_primitive(structured.buffer, ctxt);
		const os = structured.byteOffset;
		const len = structured.byteLength;
		return [ buff, os, len ];
	}

	private deserialize_data_view_like(destructured: any, ctxt: serialization_context, reg: registration) : DataView {
		const buff = this.deserialize_primitive(destructured[0], ctxt);
		const os = Number(destructured[1]);
		const len = Number(destructured[2]);
		return new DataView(buff, os, len);
	}

	private serialize_arbitrary_object(structured: any, ctxt: serialization_context, reg: registration) {
		let destructured : any[] = [];
		const is_function_like     = this.is_base_of(Function, structured.constructor);
		const is_array_like        = this.is_base_of(Array, structured.constructor);
		const is_array_buffer_like = this.is_base_of(ArrayBuffer, structured.constructor);
		const is_string_like       = this.is_base_of(String, structured.constructor);
		const is_typed_array_like  = yaserializer.typed_array_types.reduce<boolean>((previous: boolean, current: any) => {
			return previous || this.is_base_of(current, structured.constructor);
		}, false);

		destructured[0] = reg.builder.serialize(structured, ctxt, reg);

		if(reg.serialize_func) {
			const serialize_deeper = (structured: any) => {
				return this.serialize_primitive(structured, ctxt);
			};
			let [custom, perform_generic_serialization] = reg.serialize_func(structured, serialize_deeper);
			destructured.push(this.serialize_primitive(custom, ctxt));
			if(!perform_generic_serialization) {
				return destructured;
			}
		}

		let ignores: ignore_rule[] = [];
		if(ctxt.invocation_options && ctxt.invocation_options.ignore) {
			ignores = ignores.concat(ctxt.invocation_options.ignore);
		}
		if(reg.class_options && reg.class_options.ignore) {
			ignores = ignores.concat(reg.class_options.ignore);
		}
		if(this.global_options && this.global_options.ignore) {
			ignores = ignores.concat(this.global_options.ignore);
		}

		let should_ignore_label = (rule: ignore_rule, identifier: label) => {
			switch(typeof rule) {
			case 'string': return rule === identifier;
			case 'number': return rule === Number(identifier);
			case 'symbol': return rule === identifier;
			case 'object': return rule.test(String(identifier));
			}
		};

		const desc = Object.getOwnPropertyDescriptors(structured);
		const descriptors : any[] = [];
		const keys = Array.prototype.concat(Object.getOwnPropertyNames(desc), Object.getOwnPropertySymbols(desc));
		for(let prop of keys) {
			if(is_array_like || is_typed_array_like || is_array_buffer_like || is_string_like) {
				if(this.is_array_index(prop) || prop === 'length') {
					continue;
				}
			}
			if(is_function_like) {
				if(prop === 'length'
				|| prop === 'name'
				|| prop === 'prototype') {
					continue;
				}
			}

			const should_ignore = ignores.reduce<boolean>((acc: boolean, curr: ignore_rule): boolean => {
				return acc || should_ignore_label(curr, prop);
			}, false);
			if(should_ignore) {
				continue;
			}
			const descriptor : any[] = [];
			let flags : number = 0 >>> 0;
			if(desc[prop].hasOwnProperty('value')) {
				descriptor.push(0);
				descriptor.push(this.serialize_primitive(desc[prop].value, ctxt));
				
				if(desc[prop].writable === false) {
					flags = flags | 1;
				}
			}
			if(desc[prop].hasOwnProperty('get')) {
				descriptor.push(1);
				descriptor.push(this.serialize_primitive(desc[prop]['get'], ctxt));
			}
			if(desc[prop].hasOwnProperty('set')) {
				descriptor.push(2);
				descriptor.push(this.serialize_primitive(desc[prop]['set'], ctxt));
			}
			if(desc[prop].configurable === false) {
				flags = flags | 2;
			}
			if(desc[prop].enumerable === false) {
				flags = flags | 4;
			}
			if(flags) {
				descriptor.push(3);
				descriptor.push(flags);
			}
			descriptors.push(this.serialize_primitive(prop, ctxt));
			descriptors.push(descriptor);
		}

		if(descriptors.length > 0) {
			destructured.push(descriptors);
		}
		return destructured;
	}

	private deserialize_arbitrary_object(destructured: any, ctxt: serialization_context, reg: registration) {
		let structured: any = reg.builder.deserialize(destructured.shift(), ctxt, reg);
		Object.setPrototypeOf(structured, reg.clazz.prototype ? reg.clazz.prototype : null);

		if(reg.deserialize_func) {
			const deserialize_deeper = (destructured: any) => {
				return this.deserialize_primitive(destructured, ctxt);
			};
			const perform_generic_deserialization = reg.deserialize_func(structured, this.deserialize_primitive(destructured.shift(), ctxt), deserialize_deeper);
			if(!perform_generic_deserialization) {
				return structured;
			}
		}

		if(destructured.length > 0) {
			const descriptors : any[] = destructured.shift();
			for(let i = 0; i < descriptors.length; i += 2) {
				const [k, v] = descriptors.slice(i, i + 2) as [any, any[]];
				const key = this.deserialize_primitive(k, ctxt);
				const desc : any = {};
				let unstructured_value : any = undefined;
				let unstructured_get : any = undefined;
				let unstructured_set : any = undefined;
				let writable = true, configurable = true, enumerable = true;
				for(let j = 0; j < v.length; j += 2) {
					switch(v[j]) {
					case 0: // value
						desc.value = undefined;
						unstructured_value = v[j + 1];
						break;
					case 1: // get
						desc.get = undefined;
						unstructured_get = v[j + 1];
						break;
					case 2: // set
						desc.set = undefined;
						unstructured_set = v[j + 1];
						break;
					case 3: { // flags
							let flags = v[j + 1];
							writable     = !((flags & 1) === 1);
							configurable = !((flags & 2) === 2);
							enumerable   = !((flags & 4) === 4);
						}
					}
				}
				desc.configurable = configurable;
				desc.enumerable = enumerable;
				if(unstructured_value) {
					desc.writable = writable;
					placeholder.try_snap(this.deserialize_primitive(unstructured_value, ctxt), (val: any) => {
						desc.value = placeholder.try_snap(val);
						Object.defineProperty(structured, key, desc);
					});
				} else {
					placeholder.try_snap(this.deserialize_primitive(unstructured_get, ctxt), (getter: any) => {
						placeholder.try_snap(this.deserialize_primitive(unstructured_set, ctxt), (setter: any) => {
							desc['get'] = placeholder.try_snap(getter);
							desc['set'] = placeholder.try_snap(setter);
							Object.defineProperty(structured, key, desc);
						});
					});
				}
			}
		}
		return structured;
	}

	private attempt_dynamic_registration(class_name : string) {
		if(!Object.prototype.hasOwnProperty.call(registrations, class_name)) {
			return false;
		}
		let ctor = registrations[class_name];
		if(Reflect && Reflect.getMetadata && null != Reflect.getMetadata(serializable_key, ctor)) {
			const ignores          = Reflect.getMetadata(unserializable_key    , ctor);
			const srlz_name        = Reflect.getMetadata(serializer_key        , ctor);
			const desrlz_name      = Reflect.getMetadata(deserializer_key      , ctor);
			const post_action_name = Reflect.getMetadata(deserialize_action_key, ctor);
			
			const ignored     = ignores          ? (Array.isArray(ignores) ? ignores : [ignores]) : undefined
			const srlz        = srlz_name        ? ctor          [srlz_name]        : undefined;
			const desrlz      = desrlz_name      ? ctor          [desrlz_name]      : undefined;
			const post_action = post_action_name ? ctor.prototype[post_action_name] : undefined;
			const bound_post  = post_action      ? function(obj: any) { return post_action.bind(obj)(); } : undefined;
			
			this.make_class_serializable(ctor, { ignore: ignored, on_post_deserialize: bound_post }, srlz, desrlz);
			return true;
		} else {
			return false;
		}
	}

	private serialize_object(structured: any, ctxt: serialization_context): any {
		const class_name = this.get_object_class_name(structured);

		if(class_name !== 'Object' && !this.known_classes.has(class_name)) {
			if(!this.attempt_dynamic_registration(class_name)) {
				throw new Error(`class ${class_name} is not registered`);
			}
		}
		let class_idx = ctxt.find_string_index(class_name);
		let idx = ctxt.find_object_index(structured);
		if(idx === -1) {
			const substructure: any = [];
			substructure.push(class_idx);
			idx = ctxt.get_next_index(structured, substructure);
			const reg = this.known_classes.get(class_name)!;
			substructure.push(this.serialize_arbitrary_object(structured, ctxt, reg));
		}
		return idx;
	}

	private deserialize_object(destructured: any, ctxt: serialization_context): any {
		const idx = destructured as number;
		if(ctxt.structured_table[idx] !== undefined) {
			return ctxt.structured_table[idx];
		}
		ctxt.structured_table[idx] = new placeholder(idx, ctxt);

		const object_data = ctxt.destructured_table[idx];
		const class_idx = object_data[0];
		const class_name = ctxt.string_table[class_idx];
		if(!this.known_classes.has(class_name)) {
			if(!this.attempt_dynamic_registration(class_name)) {
				throw new Error(`class ${class_name} is not registered`);
			}
		}
		const reg = this.known_classes.get(class_name)!;
		const structured = this.deserialize_arbitrary_object(object_data[1], ctxt, reg);

		if(ctxt.invocation_options && ctxt.invocation_options.on_deserialize) {
			ctxt.invocation_options.on_deserialize(structured);
		}
		if(reg.class_options && reg.class_options.on_deserialize) {
			reg.class_options.on_deserialize(structured);
		}
		if(this.global_options && this.global_options.on_deserialize) {
			this.global_options.on_deserialize(structured);
		}
		if(ctxt.invocation_options && ctxt.invocation_options.on_post_deserialize) {
			ctxt.post_deserialization_actions.push(() => {
				ctxt.invocation_options!.on_post_deserialize!(structured);
			});
		}
		if(reg.class_options && reg.class_options.on_post_deserialize) {
			ctxt.post_deserialization_actions.push(() => {
				reg.class_options!.on_post_deserialize!(structured);
			});
		}
		if(this.global_options && this.global_options.on_post_deserialize) {
			ctxt.post_deserialization_actions.push(() => {
				this.global_options!.on_post_deserialize!(structured);
			});
		}

		ctxt.structured_table[idx] = structured;
		return structured;
	}

	private serialize_primitive(structured: any, ctxt: serialization_context): any {
		if(structured === undefined) {
			return [ primitive_type.special, special_type.undefined ];
		}
		if(structured === null) {
			return [ primitive_type.special, special_type.null ];
		}
		if(typeof structured === 'number' && Number.isNaN(structured)) {
			return [ primitive_type.special, special_type.nan ];
		}
		if(typeof structured === 'number' && !Number.isFinite(structured) && structured > 0) {
			return [ primitive_type.special, special_type.plus_infinity ];
		}
		if(typeof structured === 'number' && !Number.isFinite(structured) && structured < 0) {
			return [ primitive_type.special, special_type.minus_infinity ];
		}
		if(typeof structured === 'number' && Object.is(structured, -0)) {
			return [ primitive_type.special, special_type.minus_zero ];
		}

		switch(typeof structured) {
		case 'function':
		case 'object':
			return [ primitive_type.object, this.serialize_object(structured, ctxt)];
		case 'string':
			return [ primitive_type.string, ctxt.find_string_index(structured) ];
		case 'number':
		if(Number.isSafeInteger(structured)) {
				if(structured >= 0) {
					return [ primitive_type.positive_integer, structured ];
				} else {
					return [ primitive_type.negative_integer, -structured ];
				}
			} else {
				let translator = new DataView(new ArrayBuffer(8));
				translator.setFloat64(0, structured);
				return [ primitive_type.other_number, translator.getUint32(0), translator.getUint32(4) ];
			}
		case 'boolean':
			return [ primitive_type.boolean, structured ? 1 : 0 ]
		case 'bigint':
			return [ primitive_type.bigint, this.serialize_bigint(structured, ctxt) ];
		case 'symbol':
			return [ primitive_type.symbol, this.serialize_symbol(structured, ctxt) ];
		default:
			throw new Error(`don't know how to serialize an object with type ${typeof structured}`);
		}
	}

	private deserialize_primitive(destructured: any, ctxt: serialization_context): any {
		switch(typeof destructured) {
		case 'object':
			switch(destructured[0]) {
			case primitive_type.object:
				return this.deserialize_object(destructured[1], ctxt);
			case primitive_type.string:
				return String(ctxt.string_table[Number(destructured[1])]);
			case primitive_type.positive_integer:
				return Number(destructured[1]);
			case primitive_type.negative_integer:
				return -Number(destructured[1]);
			case primitive_type.other_number:
				{
					let translator = new DataView(new ArrayBuffer(8));
					translator.setUint32(0, destructured[1]);
					translator.setUint32(4, destructured[2]);
					return translator.getFloat64(0);
				}
			case primitive_type.boolean:
				return !!(destructured[1]);
			case primitive_type.bigint:
				return this.deserialize_bigint(destructured[1], ctxt);
			case primitive_type.symbol:
				return this.deserialize_symbol(destructured[1], ctxt);
			case primitive_type.special: {
				switch(destructured[1]) {
				case special_type.undefined     : return undefined;
				case special_type.null          : return null;
				case special_type.nan           : return NaN;
				case special_type.plus_infinity : return Infinity;
				case special_type.minus_infinity: return -Infinity;
				case special_type.minus_zero    : return -0;
				default: 
					throw new Error(`don't know how to decode a special of value ${destructured[1]}`);
				}
			}
		}
		default:
			throw new Error(`don't know how to deserialize an object of type ${typeof destructured}`);
		}
	}

	dense_encode(strings: any, objects: any, root?: any) {
		const json_objects = JSON.stringify(objects);
		const json_root    = (root) ? JSON.stringify(root) : '[0,0]';
		
		function encode(s: string): [number, string] {
			const symbols = '[],0123456789';
			const base_64_digits = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
			// 3 repeats of x = Dx
			// 4 repeats of x = Ex
			// 5 repeats of x = Fx
			for(let ch of symbols) {
				s = s.replace(ch.repeat(5), 'F' + ch);
				s = s.replace(ch.repeat(4), 'E' + ch);
				s = s.replace(ch.repeat(3), 'D' + ch);
			}
			let compacted = [];
			for(let i = 0; i < s.length; ++i) {
				switch(s.charAt(i)) {
				case '0': compacted.push(0x0); break;
				case '1': compacted.push(0x1); break;
				case '2': compacted.push(0x2); break;
				case '3': compacted.push(0x3); break;
				case '4': compacted.push(0x4); break;
				case '5': compacted.push(0x5); break;
				case '6': compacted.push(0x6); break;
				case '7': compacted.push(0x7); break;
				case '8': compacted.push(0x8); break;
				case '9': compacted.push(0x9); break;
				case '[': compacted.push(0xa); break;
				case ']': compacted.push(0xb); break;
				case ',': compacted.push(0xc); break;
				case 'D': compacted.push(0xd); break;
				case 'E': compacted.push(0xe); break;
				case 'F': compacted.push(0xf); break;
				default: throw new Error(`can't compact symbol ${s.charAt(i)}`);
				}
			}
			let original_length = compacted.length;
			while(compacted.length % 3 !== 0) {
				compacted.push(0);
			}
			let result = '';
			for(let i = 0; i < compacted.length; i += 3) {
				const [a, b, c] = compacted.slice(i, i + 3);
				let top    = (a << 2) | (b >> 2);
				let bottom = ((b & 0x3) << 4) | c;
				result += base_64_digits.charAt(top);
				result += base_64_digits.charAt(bottom);
			};
			return [original_length, result];
		}
		let dense_structure = [strings, encode(json_objects)];
		if(root) {
			dense_structure.push(encode(json_root));
		}
		return dense_structure;
	}

	dense_decode(dense_structure: any) {
		function decode(encoded: [number, string]) {
			const [len, s] = encoded;
			const symbols = '[],0123456789';
			const base_64_digits = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
			let compacted = [];
			for(let i = 0; i < s.length; i += 2) {
				const top = base_64_digits.indexOf(s.charAt(i));
				const bottom = base_64_digits.indexOf(s.charAt(i + 1));
				let a = top >> 2;
				let b = ((top & 0x3) << 2) | ((bottom >> 4) & 0x3);
				let c = (bottom & 0xf);
				compacted.push(a);
				compacted.push(b);
				compacted.push(c);
			}
			compacted = compacted.slice(0, len);
			let result = '';
			for(let i = 0; i < compacted.length; ++i) {
				switch(compacted[i]) {
				case 0x0: result += '0'; break;
				case 0x1: result += '1'; break;
				case 0x2: result += '2'; break;
				case 0x3: result += '3'; break;
				case 0x4: result += '4'; break;
				case 0x5: result += '5'; break;
				case 0x6: result += '6'; break;
				case 0x7: result += '7'; break;
				case 0x8: result += '8'; break;
				case 0x9: result += '9'; break;
				case 0xa: result += '['; break;
				case 0xb: result += ']'; break;
				case 0xc: result += ','; break;
				case 0xd: result += 'D'; break;
				case 0xe: result += 'E'; break;
				case 0xf: result += 'F'; break;
				}
			}
			for(let ch of symbols) {
				result = result.replace('D' + ch, ch.repeat(3));
				result = result.replace('E' + ch, ch.repeat(4));
				result = result.replace('F' + ch, ch.repeat(5));
			}
			return JSON.parse(result);
		}
		let raw_object = [ dense_structure[0], decode(dense_structure[1])];
		if(2 in dense_structure) {
			raw_object.push(decode(dense_structure[2]));
		}
		return raw_object;
	}

	serialize(structured: any, options?: options): string {
		const ctxt = new serialization_context(options);
		const destructured = this.serialize_primitive(structured, ctxt);
		const implicit_root = Array.isArray(destructured) && destructured.length == 2 && destructured[0] === 0 && destructured[1] === 0;
		let serialized : any = null;
		if((options && options.use_packed_format)
		|| (this.global_options && this.global_options.use_packed_format)) {
			if(implicit_root) {
				serialized = this.dense_encode(ctxt.string_table, ctxt.destructured_table)
			} else {
				serialized = this.dense_encode(ctxt.string_table, ctxt.destructured_table, destructured)
			}
		} else {
			if(implicit_root) {
				serialized = [ ctxt.string_table, ctxt.destructured_table ];
			} else {
				serialized = [ ctxt.string_table, ctxt.destructured_table, destructured ];
			}
		}
		if(options && options.perform_encode) {
			return options.perform_encode(serialized)
		} else if(this.global_options && this.global_options.perform_encode) {
			return this.global_options.perform_encode(serialized);
		} else {
			return JSON.stringify(serialized);
		}
	}

	deserialize(data: any, options?: options) : any {
		const decode_function = options              && options.perform_decode              ? options.perform_decode
		                      : (this.global_options && this.global_options.perform_decode) ? this.global_options.perform_decode
		                      :                                                               JSON.parse;
		let raw_object : any = decode_function(data);
		if((options && options.use_packed_format)
		|| (this.global_options && this.global_options.use_packed_format)) {
			raw_object = this.dense_decode(raw_object);
		}
		if(!Array.isArray(raw_object)
		|| (raw_object.length != 3 && raw_object.length !== 2)) {
			throw new Error(`invalid serialization data: ${Array.prototype.slice.call(data, 0, 16)}... produced ${util.inspect(raw_object)}`);
		}
		if(raw_object.length === 2) {
			raw_object.push([0,0]);
		}
		const ctxt = new serialization_context(options);
		ctxt.string_table = raw_object[0];
		ctxt.destructured_table = raw_object[1];
		const deserialized = placeholder.try_snap(this.deserialize_primitive(raw_object[2], ctxt));
		ctxt.post_deserialization_actions.forEach((action: (() => any)) => {
			action();
		});
		return deserialized;
	}
};

const serializable : ClassDecorator = (constructor: Function): void => {
	Reflect.defineMetadata(serializable_key, {}, constructor);
	registrations[constructor.name] = constructor;
}

const unserializable : PropertyDecorator = (target: Object, propertyKey: string | symbol): void => {
	const md = Reflect.getMetadata(unserializable_key, target.constructor)
	if(!md) {
		Reflect.defineMetadata(unserializable_key, [propertyKey], target.constructor);
	} else {
		md.push(propertyKey);
	}
}

const deserialize_action : MethodDecorator = (target: Object, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<any>) => {
	Reflect.defineMetadata(deserialize_action_key, propertyKey, target.constructor);
	return descriptor;
}

const serializer : MethodDecorator = (target: Object, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<any>) => {
	Reflect.defineMetadata(serializer_key, propertyKey, target);
	return descriptor;
}

const deserializer : MethodDecorator = (target: Object, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<any>) => {
	Reflect.defineMetadata(deserializer_key, propertyKey, target);
	return descriptor;
}

export {
	yaserializer,
	options,
	serializable,
	unserializable,
	serializer,
	deserializer,
	deserialize_action,
};
