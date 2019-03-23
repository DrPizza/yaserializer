import "reflect-metadata";

var util = require('util');

const serializable_key = Symbol('yaserializer.serializable');
const unserializable_key = Symbol('yaserializer.unserializable');
const deserialize_action_key = Symbol('cereralizer.deserialize_action');
const serializer_key = Symbol('yaserializer.serializer');
const deserializer_key = Symbol('yaserializer.deserializer');

class serialization_context {
	invocation_options?: yaserializer_options;
	index: any[];
	objects: any[];
	post_deserialization_actions: (() => any)[];

	constructor(options?: yaserializer_options) {
		this.invocation_options = options;
		this.index = [];
		this.objects = [];
		this.post_deserialization_actions = [];
	}

	find_object_index(obj: any): number {
		return this.objects.indexOf(obj);
	}

	get_next_index(obj: any, destructured: any): number {
		let idx = this.objects.length;
		this.objects.push(obj);
		this.index.push(destructured);
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
		if(this.ctxt.objects[this.idx] != this) {
			return this.ctxt.objects[this.idx];
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

class yaserializer_options {
	ignored: ignore_rule[];
	on_deserialize?: (obj: any) => any;
	on_post_deserialize?: (obj: any) => any;
	perform_encode?: (obj: any) => any;
	perform_decode?: (obj: any) => any;

	constructor(ignored?: ignore_rule | ignore_rule[],
	            on_deserialize?: (obj: any) => any,
	            on_post_deserialize?: (obj: any) => any,
	            perform_encode?: (obj: any) => any,
	            perform_decode?: (obj: any) => any) {
		this.ignored             = ignored ? (Array.isArray(ignored) ? ignored : [ignored]) : [];
		this.on_deserialize      = on_deserialize;
		this.on_post_deserialize = on_post_deserialize;
		this.perform_encode      = perform_encode;
		this.perform_decode      = perform_decode;
	}
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
	serialize_func?: (structured: any) => [any, boolean];
	deserialize_func?: (structured: any, destructured: any) => boolean;
	class_options?: yaserializer_options;

	constructor(clazz: arbitrary_ctor,
	            base: arbitrary_ctor,
	            builder: base_class_builder,
	            srlz?: (structured: any) => [any, boolean],
	            dsrlz?: (structured: any, destructured: any) => boolean,
	            class_options?: yaserializer_options) {
		this.clazz = clazz;
		this.base = base;
		this.builder = builder;
		this.serialize_func = srlz;
		this.deserialize_func = dsrlz;
		this.class_options = class_options;
	}
}

type TypedArray = Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array | BigInt64Array | BigUint64Array;

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
	private global_options?: yaserializer_options;

	constructor(known_classes?: arbitrary_ctor[], options?: yaserializer_options) {
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
		
		const generator_function =       function*() { yield 0; }; // I can't directly access these types
		const async_function     = async function () {          };

		this.make_class_serializable(Object           );
		this.make_class_serializable(Function         );
		this.make_class_serializable(generator_function.constructor as arbitrary_ctor); // but I can work around it
		this.make_class_serializable(async_function    .constructor as arbitrary_ctor);
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
			this.global_options = new yaserializer_options();
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
	                        options?: yaserializer_options,
	                        srlz?: (structured: any) => [any, boolean],
	                        dsrlz?: (structured: any, destructured: any) => boolean
	                        ) {
		if(!this.known_classes.has(clazz.name)) {
			const base = this.get_true_base(clazz);
			const builder = this.base_class_builders.get(base);
			if(!builder) {
				throw new Error(`I don't now how to construct objects with a base class of ${base}`);
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

	private serialize_bigint(obj: bigint) : any {
		return obj.toString();
	}

	private deserialize_bigint(obj: any) : bigint {
		return BigInt(obj);
	}

	private serialize_symbol(obj: symbol): any {
		// @ts-ignore
		const desc = obj.description;
		if(/^Symbol\./.test(desc)) {
			return { 'wk': desc.replace(/^Symbol\./, '') };
		}
		const key = Symbol.keyFor(obj);
		if(key !== undefined) {
			return { 'g': key };
		}
		throw new Error(`can't serialize local Symbol`);
	}

	private deserialize_symbol(obj: any): symbol {
		if(obj.hasOwnProperty('wk')) {
			const desc : string = obj['wk'];
			// @ts-ignore
			return Symbol[desc] as symbol;
		} else if(obj.hasOwnProperty('g')) {
			return Symbol.for(obj['g'] as string);
		}
		throw new Error(`unknown Symbol type`);
	}

	private serialize_object_like(structured: Object, ctxt: serialization_context, reg: registration): any {
		return {};
	}

	private deserialize_object_like(structured: any, ctxt: serialization_context, reg: registration): object {
		return new Object();
	}

	private serialize_error_like(structured: Error, ctxt: serialization_context, reg: registration): any {
		return {};
	}

	private deserialize_error_like(structured: any, ctxt: serialization_context, reg: registration): Error {
		return new Error();
	}

	private serialize_typed_array_like(structured: TypedArray, ctxt: serialization_context, reg: registration) {
		return Buffer.from(structured.buffer).toString('base64');
	}

	private deserialize_typed_array_like(destructured: any, ctxt: serialization_context, reg: registration): TypedArray {
		const buff = Buffer.from(destructured as string, "base64");
		const byte_array = new Uint8Array(buff).buffer;
		return new reg.base(byte_array);
	}

	private serialize_regexp_like(structured: RegExp, ctxt: serialization_context, reg: registration): any {
		return (structured as RegExp).toString();
	}

	private deserialize_regexp_like(destructured: any, ctxt: serialization_context, reg: registration): RegExp {
		let str = destructured as string;
		return new RegExp(str.substring(str.indexOf('/') + 1, str.lastIndexOf('/')), str.substring(str.lastIndexOf('/') + 1));
	}

	private serialize_boolean_like(structured: Boolean, ctxt: serialization_context, reg: registration): any {
		return structured.valueOf();
	}

	private deserialize_boolean_like(destructured: any, ctxt: serialization_context, reg: registration): Boolean {
		if(!!destructured) {
			return new Boolean(true);
		} else {
			return new Boolean(false);
		}
	}

	private serialize_number_like(structured: Number, ctxt: serialization_context, reg: registration): any {
		return structured.valueOf();
	}

	private deserialize_number_like(destructured: any, ctxt: serialization_context, reg: registration): Number {
		return new Number(destructured);
	}

	private serialize_date_like(structured: Date, ctxt: serialization_context, reg: registration): any {
		return structured.toISOString();
	}

	private deserialize_date_like(destructured: any, ctxt: serialization_context, reg: registration): Date {
		return new Date(destructured as string);
	}

	private serialize_string_like(structured: String, ctxt: serialization_context, reg: registration) : any {
		return structured.toString();
	}

	private deserialize_string_like(destructured: any, ctxt: serialization_context, reg: registration) : String {
		return new String(destructured);
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
			destructured.push([idx, this.serialize_primitive(value, ctxt)]);
		});
		return destructured;
	}

	private deserialize_array_like(destructured: any, ctxt: serialization_context, reg: registration) : Array<any> {
		let structured : any[] = [];
		destructured.forEach((pair: any[]) => {
			placeholder.try_snap(this.deserialize_primitive(pair[1], ctxt), (self: any) => {
				structured[this.to_uint_32(Number(pair[0]))] = placeholder.try_snap(self);
			});
		});
		return structured;
	}

	private serialize_map_like(structured: Map<any, any>, ctxt: serialization_context, reg: registration) : any {
		let destructured = [] as any[];
		structured.forEach((value: any, key: any) => {
			destructured.push([this.serialize_primitive(key, ctxt), this.serialize_primitive(value, ctxt)]);
		});
		return destructured;
	}

	private deserialize_map_like(destructured: any, ctxt: serialization_context, reg: registration) : Map<any, any> {
		let structured = new Map<any, any>();
		destructured.forEach((pair: any[]) => {
			const key = pair[0];
			const value = pair[1];
			placeholder.try_snap(this.deserialize_primitive(key, ctxt), (k: any) => {
				placeholder.try_snap(this.deserialize_primitive(value, ctxt), (v: any) => {
					structured.set(k, v);
				});
			});
		});
		return structured;
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

	private serialize_function_like(structured: Function, ctxt: serialization_context, reg: registration): any {
		if(!/\[native code\]/.test(structured.toString())) {
			return [structured.name, structured.toString()];
		} else {
			throw new Error(`can't serialize native functions`);
		}
	}

	private deserialize_function_like(destructured: any, ctxt: serialization_context, reg: registration): Function {
		const strict_environment = !destructured.hasOwnProperty('caller');
		const prelude = strict_environment ? `'use strict'; ` : '';
		const name = destructured[0] && destructured[0] !== 'anonymous' ? `const ${destructured[0]} = ` : '(';
		const body = destructured[1];
		const tail = destructured[0] && destructured[0] !== 'anonymous' ? `; ${destructured[0]};` : ')';
		// eval in global scope
		return (1, eval)(prelude + name + body + tail) as Function;
	}

	private serialize_array_buffer_like(structured: ArrayBuffer, ctxt: serialization_context, reg: registration) : any {
		return Buffer.from(structured as ArrayBuffer).toString('base64');
	}

	private deserialize_array_buffer_like(destructured: any, ctxt: serialization_context, reg: registration) : ArrayBuffer {
		return new Uint8Array(Buffer.from(destructured as string, 'base64')).buffer;
	}

	private serialize_data_view_like(structured: DataView, ctxt: serialization_context, reg: registration) : any {
		const buff = this.serialize_primitive(structured.buffer, ctxt);
		const os = structured.byteOffset;
		const len = structured.byteLength;
		return { b: buff, o: os, l: len };
	}

	private deserialize_data_view_like(destructured: any, ctxt: serialization_context, reg: registration) : DataView {
		const buff = this.deserialize_primitive(destructured['b'], ctxt);
		const os = Number(destructured['o']);
		const len = Number(destructured['l']);
		return new DataView(buff, os, len);
	}

	private serialize_arbitrary_object(structured: any, ctxt: serialization_context, reg: registration) {
		let destructured : any = {};
		const is_function_like     = this.is_base_of(Function, structured.constructor);
		const is_array_like        = this.is_base_of(Array, structured.constructor);
		const is_array_buffer_like = this.is_base_of(ArrayBuffer, structured.constructor);
		const is_string_like       = this.is_base_of(String, structured.constructor);
		const is_typed_array_like  = yaserializer.typed_array_types.reduce<boolean>((previous: boolean, current: any) => {
			return previous || this.is_base_of(current, structured.constructor);
		}, false);

		destructured['X'] = reg.builder.serialize(structured, ctxt, reg);

		if(reg.serialize_func) {
			let [custom, perform_generic_serialization] = reg.serialize_func(structured);
			destructured['Y'] = custom;
			if(!perform_generic_serialization) {
				return destructured;
			}
		}

		let ignores: ignore_rule[] = [];
		if(ctxt.invocation_options) {
			ignores = ignores.concat(ctxt.invocation_options.ignored);
		}
		if(reg.class_options) {
			ignores = ignores.concat(reg.class_options.ignored);
		}
		if(this.global_options) {
			ignores = ignores.concat(this.global_options.ignored);
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
		for(let prop in desc) {
			if(is_array_like || is_typed_array_like || is_array_buffer_like || is_string_like) {
				if(this.is_array_index(prop) || prop === 'length') {
					delete desc[prop];
					continue;
				}
			}
			if(is_function_like) {
				if(prop === 'length'
				|| prop === 'name'
				|| prop === 'prototype') {
					delete desc[prop];
					continue;
				}
			}

			const should_ignore = ignores.reduce<boolean>((acc: boolean, curr: ignore_rule): boolean => {
				return acc || should_ignore_label(curr, prop);
			}, false);
			if(should_ignore) {
				delete desc[prop];
				continue;
			}
			if(desc[prop].hasOwnProperty('value')) {
				desc[prop].value = this.serialize_primitive(desc[prop].value, ctxt);
				if(desc[prop].writable === true) {
					delete desc[prop].writable;
				}
			}
			if(desc[prop].hasOwnProperty('get')) {
				desc[prop]['get'] = this.serialize_primitive(desc[prop]['get'], ctxt);
			}
			if(desc[prop].hasOwnProperty('set')) {
				desc[prop]['set'] = this.serialize_primitive(desc[prop]['set'], ctxt);
			}
			if(desc[prop].configurable === true) {
				delete desc[prop].configurable;
			}
			if(desc[prop].enumerable === true) {
				delete desc[prop].enumerable;
			}
			if(desc[prop].configurable === true) {
				delete desc[prop].configurable;
			}
		}

		let prop_array = [];
		for(let p in desc) {
			prop_array.push([this.serialize_primitive(p, ctxt), desc[p]]);
		}
		if(prop_array.length > 0) {
			destructured['p'] = prop_array;
		}
		return destructured;
	}

	private deserialize_arbitrary_object(destructured: any, ctxt: serialization_context, reg: registration) {
		let structured: any = reg.builder.deserialize(destructured['X'], ctxt, reg);
		Object.setPrototypeOf(structured, reg.clazz.prototype ? reg.clazz.prototype : null);

		if(reg.deserialize_func) {
			let perform_generic_deserialization = reg.deserialize_func(structured, destructured['Y']);
			if(!perform_generic_deserialization) {
				return structured;
			}
		}

		if(destructured.hasOwnProperty('p')) {
			const prop_array : any[] = destructured['p'];
			const desc : any = {};
			prop_array.map((value: any): any => {
				desc[this.deserialize_primitive(value[0], ctxt)] = value[1];
			});
			for(let prop in desc) {
				if(!desc[prop].hasOwnProperty('configurable')) {
					desc[prop].configurable = true;
				}
				if(!desc[prop].hasOwnProperty('enumerable')) {
					desc[prop].enumerable = true;
				}
				if(!desc[prop].hasOwnProperty('configurable')) {
					desc[prop].configurable = true;
				}
				
				if(desc[prop].hasOwnProperty('value')) {
					if(!desc[prop].hasOwnProperty('writable')) {
						desc[prop].writable = true;
					}
					const unstructured = desc[prop].value;
					desc[prop].value = undefined;
					placeholder.try_snap(this.deserialize_primitive(unstructured, ctxt), (val: any) => {
						desc[prop].value = placeholder.try_snap(val);
						Object.defineProperty(structured, prop, desc[prop]);
					});
				}
				if(desc[prop].hasOwnProperty('get') || desc[prop].hasOwnProperty('set')) {
					const unstructured_getter = desc[prop]['get'];
					desc[prop]['get'] = undefined;
					const unstructured_setter = desc[prop]['set'];
					desc[prop]['set'] = undefined;
					placeholder.try_snap(this.deserialize_primitive(unstructured_getter, ctxt), (getter: any) => {
						placeholder.try_snap(this.deserialize_primitive(unstructured_setter, ctxt), (setter: any) => {
							desc[prop]['get'] = placeholder.try_snap(getter);
							desc[prop]['set'] = placeholder.try_snap(setter);
							Object.defineProperty(structured, prop, desc[prop]);
						});
					});
				}
			}
		}
		return structured;
	}

	private serialize_object(structured: any, ctxt: serialization_context): any {
		const class_name = this.get_object_class_name(structured);

		if(class_name !== 'Object' && !this.known_classes.has(class_name)) {
			if(Reflect.getMetadata && null != Reflect.getMetadata(serializable_key, structured.constructor)) {
				const ignores          = Reflect.getMetadata(unserializable_key    , structured.constructor);
				const srlz_name        = Reflect.getMetadata(serializer_key        , structured.constructor);
				const desrlz_name      = Reflect.getMetadata(deserializer_key      , structured.constructor);
				const post_action_name = Reflect.getMetadata(deserialize_action_key, structured.constructor);
				
				const options     = new yaserializer_options(ignores);
				const post_action = post_action_name ? structured[post_action_name]        : undefined;
				const srlz        = srlz_name        ? structured.constructor[srlz_name]   : undefined;
				const desrlz      = desrlz_name      ? structured.constructor[desrlz_name] : undefined;
				if(post_action) {
					options.on_post_deserialize = function(obj) { return post_action.bind(obj)(); };
				}
				this.make_class_serializable(structured.constructor, options, srlz, desrlz);
			} else {
				throw new Error(`class ${class_name} is not registered`);
			}
		}
		let idx = ctxt.find_object_index(structured);
		if(idx === -1) {
			const substructure: any = {};
			substructure['c'] = class_name;
			idx = ctxt.get_next_index(structured, substructure);
			const reg = this.known_classes.get(class_name)!;
			substructure['v'] = this.serialize_arbitrary_object(structured, ctxt, reg);
		}
		return idx;
	}

	private deserialize_object(destructured: any, ctxt: serialization_context): any {
		const idx = destructured as number;
		if(ctxt.objects[idx] !== undefined) {
			return ctxt.objects[idx];
		}
		ctxt.objects[idx] = new placeholder(idx, ctxt);

		const object_data = ctxt.index[idx];
		const class_name = object_data['c'];
		if(!this.known_classes.has(class_name)) {
			throw new Error(`class ${class_name} is not registered`);
		}
		const reg = this.known_classes.get(class_name)!;
		const structured = this.deserialize_arbitrary_object(object_data['v'], ctxt, reg);

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

		ctxt.objects[idx] = structured;
		return structured;
	}

	// m: magic value: 'undefined' | 'NaN' | 'Infinity' | 'null'
	// b: BigInt
	// y: Symbol: 'wk': string (well-known) | 'g': string (global)
	// o: object: integer | { c: class_name, a: array-like, p: property-descriptor } | null

	private serialize_primitive(structured: any, ctxt: serialization_context): any {
		if(structured === undefined) {
			return { 'm': 'undefined' };
		}
		if(structured === null) {
			return { 'm': 'null' };
		}
		if(typeof structured === 'number' && Number.isNaN(structured)) {
			return { 'm': 'NaN' };
		}
		if(typeof structured === 'number' && !Number.isFinite(structured)) {
			return { 'm': 'Infinity' };
		}

		switch(typeof structured) {
		case 'number':
			return { 'n': structured };
		case 'boolean':
			return { 'l': structured }
		case 'string':
			return { 's': structured };
		case 'bigint':
			return { 'b': this.serialize_bigint(structured) };
		case 'symbol':
			return { 'y': this.serialize_symbol(structured) };
		case 'function':
		case 'object':
			return { 'o': this.serialize_object(structured, ctxt) };
		default:
			throw new Error(`don't know how to serialize an object with type ${typeof structured}`);
		}
	}

	private deserialize_primitive(destructured: any, ctxt: serialization_context): any {
		switch(typeof destructured) {
		case 'object':
			if(destructured.hasOwnProperty('m')) {
				switch(destructured['m']) {
				case 'undefined': return undefined;
				case 'null'     : return null;
				case 'NaN'      : return NaN;
				case 'Infinity' : return Infinity;
				}
			} else if(destructured.hasOwnProperty('s')) {
				return String(destructured['s']);
			} else if(destructured.hasOwnProperty('n')) {
				return Number(destructured['n']);
			} else if(destructured.hasOwnProperty('l')) {
				return !!(destructured['l']);
			} else if(destructured.hasOwnProperty('b')) {
				return this.deserialize_bigint(destructured['b']);
			} else if(destructured.hasOwnProperty('y')) {
				return this.deserialize_symbol(destructured['y']);
			} else if(destructured.hasOwnProperty('o')) {
				return this.deserialize_object(destructured['o'], ctxt);
			}
		default:
			throw new Error(`don't know how to deserialize an object of type ${typeof destructured}`);
		}
	}

	serialize(structured: any, options?: yaserializer_options): string {
		const ctxt = new serialization_context(options);
		const destructured = this.serialize_primitive(structured, ctxt);
		const deserialized = { 'parts': ctxt.index, 'root': destructured };
		if(this.global_options && this.global_options.perform_encode) {
			return this.global_options.perform_encode(deserialized);
		} else {
			return JSON.stringify(deserialized);
		}
	}

	deserialize(data: any, options?: yaserializer_options) : any {
		const decode_function = (this.global_options && this.global_options.perform_decode) ? this.global_options.perform_decode
		                      :                                                               JSON.parse;
		const raw_object : any = decode_function(data);
		if(!raw_object.hasOwnProperty('parts') || !raw_object.hasOwnProperty('root')
		|| !(Array.isArray(raw_object.parts))) {
			throw new Error(`invalid serialization data: ${Array.prototype.slice.call(data, 0, 16)}...`);
		}
		const ctxt = new serialization_context(options);
		ctxt.index = raw_object.parts;
		const deserialized = placeholder.try_snap(this.deserialize_primitive(raw_object.root, ctxt));
		ctxt.post_deserialization_actions.forEach((action: (() => any)) => {
			action();
		});
		return deserialized;
	}
};

const serializable : ClassDecorator = (constructor: Function): void => {
	Reflect.defineMetadata(serializable_key, {}, constructor);
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

class quintet_part {
	major: string;
	minor: string;
	parts: string[];
	
	constructor(part: string) {
		this.parts = part.split('/');
		if(this.parts.length > 2) {
			throw new Error(`bad quintet fragment: ${part}`);
		}
		this.parts = this.parts.map((value: string) => { return value.trim(); });
		this.major = this.parts[0];
		this.minor = this.parts.length == 2 ? this.parts[1] : '*';
	}
	
	match(rhs: quintet_part) : boolean {
		if(this.major == '*' || rhs.major == '*') {
			return true;
		}
		if(this.major == rhs.major) {
			if(this.minor == '*' || rhs.minor == '*') {
				return true;
			}
			return this.minor == rhs.minor;
		}
		return false;
	}
	
	as_raw_string(): string {
		return this.parts.join('/');
	}
	
	toString() : string { return this.as_raw_string(); }
	
	static compare(l: quintet_part, r: quintet_part) : number {
		const sl = l.as_raw_string(), sr = r.as_raw_string();
		return sl < sr ? -1
		     : sl > sr ?  1
		     :            0;
	}
}

@serializable
class quintet {
	parts        : quintet_part[];

	constructor(quin: string) {
		let raw_parts = quin.toString().split(':');
		if(raw_parts.length != 5) {
			throw new Error(`bad quintet: ${quin.toString()}`);
		}
		this.parts = raw_parts.map((p: string) => {
			return new quintet_part(p);
		});
	}

	@unserializable
	get platform      () { return this.parts[0]; }
	@unserializable
	get toolchain     () { return this.parts[1]; }
	@unserializable
	get type          () { return this.parts[2]; }
	@unserializable
	get arch          () { return this.parts[3]; }
	@unserializable
	get configuration () { return this.parts[4]; }

	match(rhs: quintet): boolean {
		for(let i = 0; i < 5; ++i) {
			if(!this.parts[i].match(rhs.parts[i])) {
				return false;
			}
		}
		return true;
	}

	as_raw_string(): string {
		return this.parts.map((p: quintet_part) => { return p.as_raw_string(); }).join(':');
	}
	
	get [Symbol.toStringTag]() {
		return this.as_raw_string();
	}
	
	[util.inspect.custom](depth: number, options: any) {
		return this.as_raw_string();
	}
	
	toString() : string { return this.as_raw_string(); }
	
	static compare(l: quintet, r: quintet) : number {
		for(let i = 0; i < 5; ++i) {
			let cmp = quintet_part.compare(l.parts[i], r.parts[i]);
			if(cmp != 0) {
				return cmp;
			}
		}
		return 0;
	}

	@serializer
	static serialize(q: quintet) {
		return [ q.as_raw_string(), false];
	}
	
	@deserializer
	static deserialize(structured: quintet, destructured: any) {
		let q = new quintet(destructured as string);
		structured.parts = q.parts;
		return false;
	}

	static wildcard : quintet = new quintet('*:*:*:*:*');
}

export {
	yaserializer,
	yaserializer_options,
	serializable,
	unserializable,
	serializer,
	deserializer,
	deserialize_action,
};
