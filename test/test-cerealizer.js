// loosely based on https://github.com/erossignon/serialijse/blob/master/test/test_persistence.js
// which is MIT licensed, the original author and copyright holder being erossignon

var cerealizer = require('../index.js');
var expect = require('chai').expect;
var util = require('util');

(function () {
	'use strict';

	function reconstruct(cer, obj, verbose) {
		const serialized_form = cer.serialize(obj);
		if(verbose) {
			console.log('===============');
			console.log(util.inspect(obj, true, 12, true));
			console.log('---------------');
			console.log(serialized_form);
			console.log('---------------');
		}
		const reconstructed = cer.deserialize(serialized_form);
		if(verbose) {
			console.log(util.inspect(reconstructed, true, 12, true));
			console.log('===============');
		}
		return reconstructed;
	}

	describe('basic data types', function()
	{
		const cer = new cerealizer.cerealizer([]);

		it('should preserve numbers', function() {
			const obj = 5;
			
			const reconstructed = reconstruct(cer, obj);
			expect(obj).to.equal(reconstructed);
			expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
		});

		it('should preserve strings', function() {
			const obj = 'Hello, World!';
			
			const reconstructed = reconstruct(cer, obj);
			expect(obj).to.equal(reconstructed);
			expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
		});

		it('should preserve bigints', function() {
			const obj = 12345678901234567890n;

			const reconstructed = reconstruct(cer, obj);
			expect(obj).to.equal(reconstructed);
			expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
		});

		it('should preserve booleans', function() {
			const obj = true;
			
			const reconstructed = reconstruct(cer, obj);
			expect(obj).to.equal(reconstructed);
			expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
		});
	});

	describe('magic values', function()
	{
		const cer = new cerealizer.cerealizer([]);
		it('should preserve null', function() {
			const obj = null;
			
			const reconstructed = reconstruct(cer, obj);
			expect(obj).to.equal(reconstructed);
			expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
		});

		it('should preserve undefined', function() {
			var obj = undefined;

			const reconstructed = reconstruct(cer, obj);
			expect(reconstructed).to.be.an('undefined');
			expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
		});

		it('should preserve NaN', function() {
			var obj = NaN;

			const reconstructed = reconstruct(cer, obj);
			expect(reconstructed).to.be.NaN;
			expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
		});

		it('should preserve Infinity', function() {
			var obj = Infinity;

			const reconstructed = reconstruct(cer, obj);
			expect(reconstructed).to.equal(Infinity);
			expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
		});
	});

	describe('fundamental objects', function()
	{
		const cer = new cerealizer.cerealizer([]);

		it('should preserve Objects', function() {
			const obj = new Object();

			const reconstructed = reconstruct(cer, obj);
			expect(obj).to.deep.equal(reconstructed);
			expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
		});

		it('should preserve boxed Booleans', function() {
			const obj = new Boolean(true);

			const reconstructed = reconstruct(cer, obj);
			expect(obj).to.deep.equal(reconstructed);
			expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
		});

		it('should preserve boxed Numbers', function() {
			const obj = new Number(5);
			
			const reconstructed = reconstruct(cer, obj);
			expect(obj).to.deep.equal(reconstructed);
			expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
		});

		it('should preserve boxed Strings', function() {
			const obj = new String('Hello');
			
			const reconstructed = reconstruct(cer, obj);
			expect(obj).to.deep.equal(reconstructed);
			expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
		});

		it('should preserve RegExps', function() {
			const obj = /\w+/g;

			const reconstructed = reconstruct(cer, obj);
			expect(obj).to.deep.equal(reconstructed);
			expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
		});

		it('should preserve Dates', function() {
			const obj = new Date();

			const reconstructed = reconstruct(cer, obj);
			expect(obj).to.deep.equal(reconstructed);
			expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
		});

		it('should preserve Errors', function() {
			const obj = new Error('this is an error');

			const reconstructed = reconstruct(cer, obj);
			// older versions of deep-eql only compare Errors by identity, not by value.
			expect(reconstructed).to.be.instanceof(Error);
			expect(obj.name).to.be.equal(reconstructed.name);
			expect(obj.message).to.be.equal(reconstructed.message);
			expect(obj.stack).to.be.equal(reconstructed.stack);
			expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
		});

		it('should preserve global symbol identity', function() {
			const obj = Symbol.for('global');

			const reconstructed = reconstruct(cer, obj);
			expect(obj).to.equal(reconstructed);
			expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
		});

		it('should preserve well-known symbol identity', function() {
			const obj = Symbol.unscopables;

			const reconstructed = reconstruct(cer, obj);
			expect(obj).to.equal(reconstructed);
			expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
		});

		it('should not preserve local symbols', function() {
			const obj = Symbol('local');
			expect(function() { return cer.serialize(obj); }).to.throw();
		});

	});

	describe('compound data types: arrays and POJOs', function()
	{
		const cer = new cerealizer.cerealizer([]);

		it('should preserve arrays', function() {
			const obj = [1, 2, , 4, 5];
			
			const reconstructed = reconstruct(cer, obj);
			expect(obj).to.deep.equal(reconstructed);
			expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
		});

		it('should preserve ArrayBuffers', function() {
			const obj = new ArrayBuffer(16);
			
			const reconstructed = reconstruct(cer, obj);
			expect(obj).to.deep.equal(reconstructed);
			expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
		});

		it('should preserve heterogeneous arrays', function() {
			const obj = [1, 'str', , 4, 12345678901234567890n];
			
			const reconstructed = reconstruct(cer, obj);
			expect(obj).to.deep.equal(reconstructed);
			expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
		});

		it('should handle null prototypes', function() {
			{
				const obj = {};
				Object.setPrototypeOf(obj, null);
				obj.field = 'Hello';

				const reconstructed = reconstruct(cer, obj);
				expect(obj).to.deep.equal(reconstructed);
				expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
			}
		});

		it('should handle a POJO made up of primitive data types', function () {
			const obj = { str: 'string', num: 5, bi: 12345678901234567890n, b: true,
			              sa: ['str1', 'str2'], na: [1, 2, 3], bia: [12345678901234567890n, 22345678901234567890n, 32345678901234567890n], ba: [false, true],
			              mixed: [1, 'str', , 4, 12345678901234567890n, { a: 'a', b: 'b' } ]};

			const reconstructed = reconstruct(cer, obj);
			expect(obj).to.deep.equal(reconstructed);
		});

		it('should handle cyclic structures', function () {
			const obj1 = { which: 1, parent: null, children: [] };
			const obj2 = { which: 2, parent: obj1, children: [] };
			const obj3 = { which: 3, parent: obj1, children: [] };
			const obj4 = { which: 4, parent: obj2, children: [] };
			const obj5 = { which: 5, parent: obj2, children: [] };
			const obj6 = { which: 6, parent: obj2, children: [] };
			const obj7 = { which: 7, parent: obj4, children: [] };
			const obj8 = { which: 8, parent: obj4, children: [] };
			obj1.children = [obj2, obj3];
			obj2.children = [obj4, obj5, obj6];
			obj3.children = [obj7, obj8];
			obj1.parent = obj5;

			expect(function() { return JSON.stringify(obj1); }).to.throw();

			const reconstructed = reconstruct(cer, obj1);
			expect(obj1).to.be.deep.equal(reconstructed);
		});
	});

	describe('functions', function () {
		const cer = new cerealizer.cerealizer();

		it('should serialize a normal function', function() {
			const obj = function(arg) { console.log(`Hello, ${arg}`); };

			const reconstructed = reconstruct(cer, obj);
			// deep-eql does not seem to be able to compare functions directly
			expect(reconstructed).to.be.instanceof(Function);
			expect(obj.name).to.be.equal(reconstructed.name);
			expect(obj.length).to.be.equal(reconstructed.length);
			expect(obj.toString()).to.be.equal(reconstructed.toString());
			expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
		});

		it('should serialize a Function object', function() {
			const obj = new Function('a', 'b', 'return a + b;');

			const reconstructed = reconstruct(cer, obj);
			// deep-eql does not seem to be able to compare functions directly
			expect(reconstructed).to.be.instanceof(Function);
			expect(obj.name).to.be.equal(reconstructed.name);
			expect(obj.length).to.be.equal(reconstructed.length);
			expect(obj.toString()).to.be.equal(reconstructed.toString());
			expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
		});


		it('should serialize an async function', function() {
			const obj = async function(arg) { return await `Hello, ${arg}`; };
			const reconstructed = reconstruct(cer, obj);
			// deep-eql does not seem to be able to compare functions directly
			expect(reconstructed).to.be.instanceof(Function);
			expect(obj.name).to.be.equal(reconstructed.name);
			expect(obj.length).to.be.equal(reconstructed.length);
			expect(obj.toString()).to.be.equal(reconstructed.toString());
			expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
		});

		it('should serialize generator function', function() {
			const obj = function*(arg) { yield `Hello, ${arg}`; };

			const reconstructed = reconstruct(cer, obj);
			// deep-eql does not seem to be able to compare functions directly
			expect(reconstructed).to.be.instanceof(Function);
			expect(obj.name).to.be.equal(reconstructed.name);
			expect(obj.length).to.be.equal(reconstructed.length);
			expect(obj.toString()).to.be.equal(reconstructed.toString());
			expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
		});

		it('should not serialize a native function', function() {
			const obj = eval;

			expect(function() { return cer.serialize(obj); }).to.throw();
		});

	});

	describe('classes', function () {
		function LegacyClass(name) {
			this.name = name;
		}

		class Color {
			constructor(colorName) {
				this.name = colorName;
			}
		}
	
		class Vehicle {
			constructor() {
				this.brand = 'Fiat';
				this.price = 10000.05;
				this.color = new Color('blue');
				this.created_on = new Date('04 May 1956 GMT');
			}
		}

		const cer = new cerealizer.cerealizer([LegacyClass, Color, Vehicle]);

		it('should preserve old-style classes', function() {
			const obj = new LegacyClass('legacy');
			
			const reconstructed = reconstruct(cer, obj);
			expect(obj).to.deep.equal(reconstructed);
		});

		it('should preserve object classes', function () {
			const obj = new Vehicle();

			const reconstructed = reconstruct(cer, obj);
			expect(reconstructed).to.be.instanceof(Vehicle);
			expect(obj).to.be.deep.equal(reconstructed);
		});

		it('should preserve arrays of objects', function () {
			const obj = [new Vehicle(), new Vehicle()];
			obj[0].brand = 'Renault';
			obj[0].price = 95000;
			obj[0].created_on = new Date('Wed, 04 May 1949 22:00:00 GMT');

			const reconstructed = reconstruct(cer, obj);
			expect(obj).to.be.deep.equal(reconstructed);
		});

		it('should preserve object identity in arrays', function () {
			const the_vehicle = new Vehicle();
			the_vehicle.brand = 'Citroen';
			the_vehicle.price = 95000;
			the_vehicle.created_on = new Date('Wed, 04 May 1949 22:00:00 GMT');

			const obj = [the_vehicle, the_vehicle];
			const reconstructed = reconstruct(cer, obj)

			expect(obj).to.be.deep.equal(reconstructed);
			expect(reconstructed[0]).to.be.equal(reconstructed[1]);
		});

		it('should preserve properties', function () {
			class Rectangle {
				constructor() {
					this.width = 10;
					this.height = 20;
					Object.defineProperty(this, 'area', {
						get: function () {
							return this.width * this.height;
						}
					});
				}
			}

			Object.defineProperty(Rectangle.prototype, 'perimeter', {
				get: function() {
					return (this.width + this.height) * 2.0;
				}
			});

			const rcer = new cerealizer.cerealizer([Rectangle]);

			var obj = new Rectangle();
			obj.width = 10;
			obj.height = 10;
			expect(obj.area).to.be.equal(100);
			expect(obj.perimeter).to.be.equal(40);

			const reconstructed = reconstruct(rcer, obj);

			expect(obj).to.be.deep.equal(reconstructed);

			reconstructed.width = 20;
			expect(reconstructed.area).to.be.equal(200);
			expect(reconstructed.perimeter).to.be.equal(60);
		});

		it('should preserve typed arrays', function () {
			const obj = {
				float32: new Float32Array([1.1, 2.2, 3.3, 5.5, 6.6, 10.01, 100.001]),
				uint32: new Int32Array([1, 2, 3, 5, 6, 10, 100])
			};

			const reconstructed = reconstruct(cer, obj);
			expect(obj).to.be.deep.equal(reconstructed);
		});
		
		it('should preserve DataViews', function() {
			const obj = new DataView(new ArrayBuffer(16));
			obj.setUint32( 0, 0xdeadbeef, true);
			obj.setUint32( 4, 0xcafebabe, true);
			obj.setUint32( 8, 0xcafebeef, true);
			obj.setUint32(12, 0xdeadbabe, true);
			
			const reconstructed = reconstruct(cer, obj);
			expect(obj).to.be.deep.equal(reconstructed);
		});

		it('should properly handle extensions of the extensible built-in types', function() {
			class XObject extends Object {
				constructor(...args) {
					super(...args);
					this.extension = 1;
				}
			};
			class XFunction extends Function {
				constructor(...args) {
					super(...args);
					this.extension = 1;
				}
			};
			class XArray extends Array {
					constructor(...args) {
						super(...args);
						this.extension = 1;
					}
			};
			class XNumber extends Number {
					constructor(...args) {
						super(...args);
						this.extension = 1;
					}
			};
			class XError extends Error {
					constructor(...args) {
						super(...args);
						this.extension = 1;
					}
			};
			class XRegExp extends RegExp {
					constructor(...args) {
						super(...args);
						this.extension = 1;
					}
			};
			class XBoolean extends Boolean {
					constructor(...args) {
						super(...args);
						this.extension = 1;
					}
			};
			class XMap extends Map {
					constructor(...args) {
						super(...args);
						this.extension = 1;
					}
			};
			class XSet extends Set {
					constructor(...args) {
						super(...args);
						this.extension = 1;
					}
			};
			class XDate extends Date {
					constructor(...args) {
						super(...args);
						this.extension = 1;
					}
			};
			class XArrayBuffer extends ArrayBuffer {
				constructor(...args) {
					super(...args);
					this.extension = 1;
				}
			};
			class XFloat32Array extends Float32Array {
					constructor(...args) {
						super(...args);
						this.extension = 1;
					}
			};
			class XDataView extends DataView {
				constructor(...args) {
					super(...args);
					this.extension = 1;
				}
			};
			const xcer = new cerealizer.cerealizer([XObject, XFunction, XArray, XNumber, XError, XRegExp, XBoolean, XMap, XSet, XDate, XArrayBuffer, XFloat32Array, XDataView]);

			{
				const xab = new XArrayBuffer(16);
				const xdv = new XDataView(xab);
				xdv.setUint32( 0, 0xdeadbeef, true);
				xdv.setUint32( 4, 0xcafebabe, true);
				xdv.setUint32( 8, 0xcafebeef, true);
				xdv.setUint32(12, 0xdeadbabe, true);
				const xa = XArray.from([1, 2, , 4, 5]);
				delete xa[2];
				
				const obj = [
					new XObject(), xa, new XNumber(3), new XRegExp(/\w+/g), new XBoolean(true),
					new XMap([['a', 2], ['c', 4], ['z', 6], ['A', 12]]), new XSet([1, '2', 3]), new XDate(), xab,
					new XFloat32Array([1.1, 2.2, 3.3, 5.5, 6.6, 10.01, 100.001]), xdv
				];

				const reconstructed = reconstruct(xcer, obj);
				expect(obj).to.be.deep.equal(reconstructed);
				
				obj.forEach((value, idx) => {
					expect(Object.prototype.toString.call(obj[idx])).to.equal(Object.prototype.toString.call(reconstructed[idx]));
				});
			}
			{
				const obj = [new XFunction('a', 'return a;'), new XError('msg')];

				// deep-eql does not seem to be able to compare functions directly
				const reconstructed = reconstruct(xcer, obj);
				expect(reconstructed[0]).to.be.instanceof(Function);
				expect(reconstructed[0]).to.be.instanceof(XFunction);
				expect(obj[0].name).to.be.equal(reconstructed[0].name);
				expect(obj[0].length).to.be.equal(reconstructed[0].length);
				expect(obj[0].toString()).to.be.equal(reconstructed[0].toString());
			
				expect(reconstructed[1]).to.be.instanceof(Error);
				expect(reconstructed[1]).to.be.instanceof(XError);
				expect(obj[1].name).to.be.equal(reconstructed[1].name);
				expect(obj[1].message).to.be.equal(reconstructed[1].message);
				expect(obj[1].stack).to.be.equal(reconstructed[1].stack);
			
				obj.forEach((value, idx) => {
					expect(Object.prototype.toString.call(obj[idx])).to.equal(Object.prototype.toString.call(reconstructed[idx]));
				});
			}
		});
	});

	describe('options change serialization and deserialization behaviour', function () {
		it('should not preserve ignored members', function () {
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
			const global_options = new cerealizer.cerealizer_options(['$global_ignored']);
			const cer = new cerealizer.cerealizer([], global_options);

			const class_options = new cerealizer.cerealizer_options([/\$class.*/]);
			cer.make_class_serializable(ExcludedMembers, class_options);

			const obj = new ExcludedMembers();
			obj._cache = [1, 2, 3];

			const invocation_options = new cerealizer.cerealizer_options(['$invocation_ignored']);
			const serialized_form = cer.serialize(obj, invocation_options);
			const reconstructed = cer.deserialize(serialized_form);

			expect('always included').to.be.equal(reconstructed.name);
			expect(reconstructed.$invocation_ignored).to.be.an('undefined');
			expect(reconstructed.$class_ignored).to.be.an('undefined');
			expect(reconstructed.$serial_ignored).to.be.an('undefined');
		});

		it('should run on_deserialize during deserialization', function () {
			class DeserializeAction {
				constructor() {
					this.name = 'unset';
					this._cache = [];
				}
				
				rebuild_cache() {
					if(this._cache === undefined) {
						this._cache = [];
					};
					this._cache.push('rebuild_cache has been called');
				}
			}
	
			const instance_options = new cerealizer.cerealizer_options();
			const cer = new cerealizer.cerealizer([], instance_options);
			const class_options = new cerealizer.cerealizer_options(
				[
					'_cache'
				],
				(obj) => {
					obj.rebuild_cache();
				}
			);
			cer.make_class_serializable(DeserializeAction, class_options);

			const obj = new DeserializeAction();
			obj._cache.push(36);

			const reconstructed = reconstruct(cer, obj);
			expect(reconstructed._cache).to.be.deep.equal(['rebuild_cache has been called']);
		});

		it('should run on_post_deserialize after deserialization', function () {
			class PostDeserializeAction {
				constructor() {
					this.name = 'unset';
					this._cache = [];
				}
				
				rebuild_cache() {
					if(this._cache === undefined) {
						this._cache = [];
					};
					this._cache.push('rebuild_cache has been called');
				}
			}
	
			const cer = new cerealizer.cerealizer();
			const options = new cerealizer.cerealizer_options(
				[
					'_cache'
				],
				null,
				(obj) => {
					obj.rebuild_cache();
				}
			);
			cer.make_class_serializable(PostDeserializeAction, options);

			const obj = new PostDeserializeAction();
			obj._cache.push(36);

			const reconstructed = reconstruct(cer, obj);
			expect(reconstructed._cache).to.be.deep.equal(['rebuild_cache has been called']);
		});
	});

	describe('general utility', function () {
		const cer = new cerealizer.cerealizer([]);

		it('should let me perform final encoding in different ways', function() {
			const BSON = require('bson');
			const instance_options = new cerealizer.cerealizer_options();
			instance_options.perform_encode = BSON.serialize;
			instance_options.perform_decode = BSON.deserialize;
			const bcer = new cerealizer.cerealizer([], instance_options);
			
			const obj = { d: new Date(), s: 'string', arr: [1, 2, 3] };
			
			const reconstructed = reconstruct(bcer, obj);
			expect(reconstructed).to.be.deep.equal(obj);
		});
	
		it('should let me perform final encoding in more complex ways', function() {
			const BSON = require('bson');
			const zlib = require('zlib');
			const instance_options = new cerealizer.cerealizer_options();
			instance_options.perform_encode = function(obj) {
				const serial_form = BSON.serialize(obj);
				return zlib.deflateSync(serial_form);
			};
			instance_options.perform_decode = function(obj) {
				const serial_form = zlib.inflateSync(obj);
				return BSON.deserialize(serial_form);
			};
			const bcer = new cerealizer.cerealizer([], instance_options);
			
			const obj = { d: new Date(), s: 'string', arr: [1, 2, 3] };
			
			const reconstructed = reconstruct(bcer, obj);
			expect(reconstructed).to.be.deep.equal(obj);
		});
		
		it('should automatically register decorated classes', function() {
			// @serializable
			class Test {
			// 	field: string;

			// 	@unserializable
			// 	cache: any[];

			// 	@unserializable
			// 	version: number;

				constructor() {
					this.field = 'Hello, world!';
					this.cache = [];
					this.version = 1;
				}

			// 	@deserialize_action
				rebuild() {
					this.cache = ['rebuilt'];
					this.version = 20;
				}
			};
			const obj = new Test();
			
			Reflect.decorate([cerealizer.serializable], Test);
			Reflect.decorate([cerealizer.unserializable], obj, 'cache');
			Reflect.decorate([cerealizer.unserializable], obj, 'version');
			Reflect.decorate([cerealizer.deserialize_action], obj, 'rebuild');
			
			const cer = new cerealizer.cerealizer([]);
			
			const reconstructed = reconstruct(cer, obj);
			expect(reconstructed.cache).to.be.deep.equal(['rebuilt']);
			expect(reconstructed.version).to.be.equal(20);
			expect(reconstructed.field).to.be.equal('Hello, world!');
			expect(reconstructed).to.be.instanceof(Test);
		});
	});
}());
