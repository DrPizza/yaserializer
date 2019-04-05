# yaserializer, because there's still no particularly good solution to this problem

Why yes, it's yet another serialization library for JavaScript, because this problem that damn well ought to be solved as a built-in feature of the runtime environment still isn't. This is in spite of JavaScript runtimes having to include not one but two serialization mechanisms as built-ins: the well-known `JSON.stringify()`, and the much less well-known HTML Structured Clone algorithm that's used to pass object graphs between Workers.

The inadequacies of JSON are well-known: it doesn't even support all the basic built-in JavaScript classes (RegExp, Date, the TypedArray family, Error, and not to mention the new BigInt, Map, Set, and Symbol), it cannot handle arbitrary object graphs (only trees), it does not preserve class identity, it does not preserve functions or object properties, it does not properly preserve special values like undefined and NaN. It supports only a very limited subset of JavaScript's data description, and can serialize that. Worse, while for some JSON-able objects it generates errors (cycles, for example, generate exceptions) others, such as Maps, just get silently swallowed.

The HTML Structured Clone algorithm improves somewhat on JSON. It can handle graphs that contain cycles, for example, and it supports some more data types. But it retains other flaws: no functions or class identities, for example. It's also awkward to use; there's no direct API for it. Instead, the environment just calls it automagically when passing data to a Worker or back.

A search of npm finds a reasonable assortion of serialization libraries. But none of them seem to be ideal, exactly. They all retain one or more of the above flaws, rendering them undesirable for the role I have. JavaScript includes some very subtle ways of determining an object's type (`Object.prototype.toString` accessing the inaccessible `[[Class]]` property is particularly awesome, for example), and they require some finesse to replicate. I want to support classes but without requiring a no-args constructor to give me an empty object to populate. Object graphs need to be preserved, including cycles. I want to support the new datatypes where it makes sense to (`WeakMap` and `WeakSet` don't make sense to deserialize), and properly handle extensions of any built-in types (not just `Object`!).

Custom classes must be registered. Serialization does not preserve the actual class definitions, only their name, and so on the deserialization side there needs to be some way to look up a class implementation given only a name. Registration sets up this name to class mapping. Arbitrary objects and the built-in classes do not need registration. 

As with any JavaScript serialization library, there's some things that can't be serialized: closures and the forthcoming private properties. TC39 is opting for hard privacy over deep cloning, so you'll need to write custom serialization code to handle classes that have true private data, whether that privacy is using the classic closure approach, or the new `#` prefix on property names. There are hooks provided to set custom serializers for this very scenario.

I've only written and tested on Node 11.12, which is current at the time of writing. I'm using TypeScript, because it really does make writing JavaScript less painful. There's preliminary support for decorators, too, using the `Reflect` metadata API. With this, you can write self-registering classes that can mark fields as non-serialized, plumb in custom serialization methods, and set up post-deserialization functions.

The output format is not stable and there is no guarantee that you'll be able to decode data from one version in another version. This might change in the future once I'm happy with the overall behaviour of the library. The output is encoded as arrays with a separate string table. The array portion can optionally be packed into a single string with limited RLE compression and a dense base64 encoding, by setting the option `use_packed_format` to `true`.

# Some code snippets I guess

Ignores:

```javascript

class ExcludedMembers {
	constructor() {
		this.name                = 'always included';
		this.$invocation_ignored = 'excluded by invocation options';
		this.$class_ignored      = 'excluded by class options';
		this.$global_ignored     = 'excluded by global options';
		this._cache              = [];
		this.$someOtherStuff     = 0;
	}
}
const global_options = { ignore: '$global_ignored' };
const ser = new yas.yaserializer([], global_options);

const class_options = { ignore: /\$class.*/ };
ser.make_class_serializable(ExcludedMembers, class_options);

const obj = new ExcludedMembers();
obj._cache = [1, 2, 3];

const invocation_options = { ignore: '$invocation_ignored' };
const serialized_form = ser.serialize(obj, invocation_options);
const reconstructed = ser.deserialize(serialized_form);

```

Decorators, custom serialization methods, in TypeScript:

```typescript

@yas.serializable
class Test {
	field: string;

	@yas.unserializable
	cache: any[];

	@yas.unserializable
	version: number;

	constructor() {
		this.field = 'Hello, world!';
		this.cache = [];
		this.version = 1;
	}

	// serializer method returns a pair. the first element 
	// contains the custom serialized data.
	// the second is 'true' to augment the custom serialization
	// with the usual brute force property-by-property
	// serialization, 'false' to skip it and rely only on 
	// the custom serialized data.
	@yas.serializer
	static serialize(obj) {
		return [obj.field + ' serialized form', false];
	}

	// structured is a hollowed out object of the right type
	// but without any of its members. destructured is the 
	// custom serialized data created by the serializer method.
	// return true to also use built-in propery-by-property
	// deserialization; false to skip it.
	@yas.deserializer
	static deserialize(structured, destructured) {
		structured.field = destructured + ' reconstituted';
		return false;
	}

	// executed after the entire object graph is deserialized. 
	@yas.deserialize_action
	rebuild() {
		this.cache = ['rebuilt'];
		this.version = 20;
	}
};

```
