// loosely based on https://github.com/erossignon/serialijse/blob/master/test/test_persistence.js
// which is MIT licensed, the original author and copyright holder being erossignon

var yas = require('../dist/yaserializer.js');
var expect = require('chai').expect;
var util = require('util');

util.inspect.defaultOptions.compact = true;
util.inspect.defaultOptions.depth = 6;
util.inspect.defaultOptions.breakLength = 135;
util.inspect.defaultOptions.showHidden = true;
util.inspect.defaultOptions.colors = true;

(function() {
	'use strict';

	const verbose_by_default = false;
	const packed_options = [false, true];

	packed_options.map(function (pack) {
		const pack_by_default = pack;

		function reconstruct(ser, obj, packed = pack_by_default, verbose = verbose_by_default) {
			let options = { use_packed_format: packed };
			const serialized_form = ser.serialize(obj, options);
			if (verbose) {
				console.log('===============');
				console.log(util.inspect(obj, true, 12, true));
				console.log('---------------');
				console.log(serialized_form);
				console.log('---------------');
			}
			const reconstructed = ser.deserialize(serialized_form, options);
			if (verbose) {
				console.log(util.inspect(reconstructed, true, 12, true));
				console.log('===============');
			}
			return reconstructed;
		}
	
		describe(pack ? 'using packed encoding' : 'using standard encoding', function() {
			describe('basic data types', function() {
				const ser = new yas.yaserializer([]);
				
				describe('numbers', function(){
					it('should preserve safe integers', function() {
						const obj = 5;
			
						const reconstructed = reconstruct(ser, obj);
						expect(obj).to.equal(reconstructed);
						expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
					});
			
					it('should preserve unsafe integers', function() {
						const obj = Number.MAX_SAFE_INTEGER + 1;
			
						const reconstructed = reconstruct(ser, obj);
						expect(obj).to.equal(reconstructed);
						expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
					});
			
					it('should preserve floating point numbers', function() {
						const obj = 5.5;
			
						const reconstructed = reconstruct(ser, obj);
						expect(obj).to.equal(reconstructed);
						expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
					});
			
					it('should preserve negative safe integers', function() {
						const obj = -5;
			
						const reconstructed = reconstruct(ser, obj);
						expect(obj).to.equal(reconstructed);
						expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
					});
			
					it('should preserve negative unsafe integers', function() {
						const obj = -Number.MAX_SAFE_INTEGER - 1;
			
						const reconstructed = reconstruct(ser, obj);
						expect(obj).to.equal(reconstructed);
						expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
					});
			
					it('should preserve negative floating point numbers', function() {
						const obj = -5.5;
			
						const reconstructed = reconstruct(ser, obj);
						expect(obj).to.equal(reconstructed);
						expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
					});
				})
		
				it('should preserve strings', function() {
					const obj = 'Hello, World!';
		
					const reconstructed = reconstruct(ser, obj);
					expect(obj).to.equal(reconstructed);
					expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
				});
		
				it('should preserve bigints', function() {
					const obj = 12345678901234567890n;
		
					const reconstructed = reconstruct(ser, obj);
					expect(obj).to.equal(reconstructed);
					expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
				});
		
				it('should preserve booleans', function() {
					const obj = true;
		
					const reconstructed = reconstruct(ser, obj);
					expect(obj).to.equal(reconstructed);
					expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
				});
			});
		
			describe('magic values', function() {
				const ser = new yas.yaserializer([]);

				describe('existence', function() {
					it('should preserve null', function() {
						const obj = null;
			
						const reconstructed = reconstruct(ser, obj);
						expect(obj).to.equal(reconstructed);
						expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
					});
			
					it('should preserve undefined', function() {
						var obj = undefined;
			
						const reconstructed = reconstruct(ser, obj);
						expect(reconstructed).to.be.an('undefined');
						expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
					});
				});
				
				describe('numeric', function() {
					it('should preserve 0', function() {
						const obj = 0;
			
						const reconstructed = reconstruct(ser, obj);
						expect(obj).to.equal(reconstructed);
						expect(1 / obj).to.equal(1 / reconstructed);
						expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
					});
			
					it('should preserve -0', function() {
						const obj = -0;
			
						const reconstructed = reconstruct(ser, obj);
						expect(obj).to.equal(reconstructed);
						expect(1 / obj).to.equal(1 / reconstructed);
						expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
					});
			
					it('should preserve NaN', function() {
						var obj = NaN;
			
						const reconstructed = reconstruct(ser, obj);
						expect(reconstructed).to.be.NaN;
						expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
					});
			
					it('should preserve Infinity', function() {
						var obj = Infinity;
			
						const reconstructed = reconstruct(ser, obj);
						expect(reconstructed).to.equal(Infinity);
						expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
					});
			
					it('should preserve -Infinity', function() {
						var obj = -Infinity;
			
						const reconstructed = reconstruct(ser, obj);
						expect(reconstructed).to.equal(-Infinity);
						expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
					});
				});
			});
		
			describe('fundamental objects', function() {
				const ser = new yas.yaserializer([]);
		
				it('should preserve Objects', function() {
					const obj = new Object();
		
					const reconstructed = reconstruct(ser, obj);
					expect(obj).to.deep.equal(reconstructed);
					expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
				});
		
				it('should preserve boxed Booleans', function() {
					const obj = new Boolean(true);
		
					const reconstructed = reconstruct(ser, obj);
					expect(obj).to.deep.equal(reconstructed);
					expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
				});
		
				it('should preserve boxed Numbers', function() {
					const obj = new Number(5);
		
					const reconstructed = reconstruct(ser, obj);
					expect(obj).to.deep.equal(reconstructed);
					expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
				});
		
				it('should preserve boxed Strings', function() {
					const obj = new String('Hello');
		
					const reconstructed = reconstruct(ser, obj);
					expect(obj).to.deep.equal(reconstructed);
					expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
				});
		
				it('should preserve RegExps', function() {
					const obj = /\w+/g;
		
					const reconstructed = reconstruct(ser, obj);
					expect(obj).to.deep.equal(reconstructed);
					expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
				});
		
				it('should preserve Dates', function() {
					const obj = new Date();
		
					const reconstructed = reconstruct(ser, obj);
					expect(obj).to.deep.equal(reconstructed);
					expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
				});
		
				it('should preserve Errors', function() {
					const obj = new Error('this is an error');
		
					const reconstructed = reconstruct(ser, obj);
					// older versions of deep-eql only compare Errors by identity, not by value.
					expect(reconstructed).to.be.instanceof(Error);
					expect(obj.name).to.be.equal(reconstructed.name);
					expect(obj.message).to.be.equal(reconstructed.message);
					expect(obj.stack).to.be.equal(reconstructed.stack);
					expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
				});
		
				describe('symbols', function(){
					it('should preserve global symbol identity', function() {
						const obj = Symbol.for('global');
			
						const reconstructed = reconstruct(ser, obj);
						expect(obj).to.equal(reconstructed);
						expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
					});
			
					it('should preserve well-known symbol identity', function() {
						const obj = Symbol.unscopables;
			
						const reconstructed = reconstruct(ser, obj);
						expect(obj).to.equal(reconstructed);
						expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
					});
			
					it('should not preserve local symbols', function() {
						const obj = Symbol('local');
						expect(function() {
							return ser.serialize(obj);
						}).to.throw();
					});
				});
			});
		
			describe('compound data types: arrays and POJOs', function() {
				const ser = new yas.yaserializer([]);
		
				describe('array-like objects', function() {
					it('should preserve arrays', function() {
						const obj = [1, 2, , 4, 5];
			
						const reconstructed = reconstruct(ser, obj);
						expect(obj).to.deep.equal(reconstructed);
						expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
					});
			
					it('should preserve ArrayBuffers', function() {
						const obj = new ArrayBuffer(16);
			
						const reconstructed = reconstruct(ser, obj);
						expect(obj).to.deep.equal(reconstructed);
						expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
					});
			
					it('should preserve heterogeneous arrays', function() {
						const obj = [1, 'str', , 4, 12345678901234567890n];
			
						const reconstructed = reconstruct(ser, obj);
						expect(obj).to.deep.equal(reconstructed);
						expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
					});
				});
				
				it('should handle null prototypes', function() {
					{
						const obj = Object.create(null);
						obj.field = 'Hello';
		
						const reconstructed = reconstruct(ser, obj);
						expect(obj).to.deep.equal(reconstructed);
						expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
					}
				});
		
				it('should handle a POJO made up of primitive data types', function() {
					const obj = {
						str: 'string',
						num: 5,
						bi: 12345678901234567890n,
						b: true,
						sa: ['str1', 'str2'],
						na: [1, 2, 3],
						bia: [12345678901234567890n, 22345678901234567890n, 32345678901234567890n],
						ba: [false, true],
						mixed: [1, 'str', , 4, 12345678901234567890n, { a: 'a', b: 'b' }]
					};
		
					const reconstructed = reconstruct(ser, obj);
					expect(obj).to.deep.equal(reconstructed);
				});
		
				it('should handle cyclic structures', function() {
					const obj0 = { which: 0x0, parent: null, children: [] };
					const obj1 = { which: 0x1, parent: obj0, children: [] };
					const obj2 = { which: 0x2, parent: obj0, children: [] };
					const obj3 = { which: 0x3, parent: obj0, children: [] };
					const obj4 = { which: 0x4, parent: obj1, children: [] };
					const obj5 = { which: 0x5, parent: obj1, children: [] };
					const obj6 = { which: 0x6, parent: obj1, children: [] };
					const obj7 = { which: 0x7, parent: obj2, children: [] };
					const obj8 = { which: 0x8, parent: obj2, children: [] };
					const obj9 = { which: 0x9, parent: obj2, children: [] };
					const obja = { which: 0xa, parent: obj3, children: [] };
					const objb = { which: 0xb, parent: obj3, children: [] };
					const objc = { which: 0xc, parent: obj3, children: [] };
					obj0.children = [obj1, obj2, obj3];
					
					obj1.children = [obj4, obj5, obj6];
					obj2.children = [obj7, obj8, obj9];
					obj3.children = [obja, objb, objc];
					
					obj4.children = [obj4, obj7, obja];
					obj5.children = [obj5, obj8, objb];
					obj6.children = [obj6, obj9, objc];
					
					obj7.children = [obj4, obj7, obja];
					obj8.children = [obj5, obj8, objb, obj0];
					obj9.children = [obj6, obj9, objc];
					
					obja.children = [obj4, obj7, obja];
					objb.children = [obj5, obj8, objb];
					objc.children = [obj6, obj9, objc];
					
					obj0.parent = obj8;
		
					expect(function() {
						return JSON.stringify(obj0);
					}).to.throw();
		
					const reconstructed = reconstruct(ser, obj0);
					expect(obj0).to.be.deep.equal(reconstructed);
				});
				
				it('should handle more cyclic structures', function() {
					const obj = [];
					obj[0] = obj;
					
					const reconstructed = reconstruct(ser, obj);
					expect(obj).to.be.deep.equal(reconstructed);
				});
			});
		
			describe('functions', function() {
				const ser = new yas.yaserializer();
		
				it('should serialize a strict normal function', function() {
					const obj = (1, eval)('"use strict"; (function(arg) { console.log(`Hello, ${arg}`); })');

					const reconstructed = reconstruct(ser, obj);
					// deep-eql does not seem to be able to compare functions directly
					expect(reconstructed).to.be.instanceof(Function);
					expect(obj.name).to.be.equal(reconstructed.name);
					expect(obj.length).to.be.equal(reconstructed.length);
					expect(function() {
						return reconstructed.caller;
					}).to.throw();
					expect(obj.toString()).to.be.equal(reconstructed.toString());
					expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
				});
		
				it('should serialize a non-strict normal function', function() {
					const obj = (1, eval)('(function(arg) { console.log(`Hello, ${arg}`); })');
		
					const reconstructed = reconstruct(ser, obj);
					// deep-eql does not seem to be able to compare functions directly
					expect(reconstructed).to.be.instanceof(Function);
					expect(obj.name).to.be.equal(reconstructed.name);
					expect(obj.length).to.be.equal(reconstructed.length);
					expect(obj.caller).to.be.equal(reconstructed.caller);
					expect(obj.toString()).to.be.equal(reconstructed.toString());
					expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
				});
		
				it('should serialize a Function object', function() {
					const obj = new Function('a', 'b', 'return a + b;');
		
					const reconstructed = reconstruct(ser, obj);
					// deep-eql does not seem to be able to compare functions directly
					expect(reconstructed).to.be.instanceof(Function);
					expect(obj.name).to.be.equal(reconstructed.name);
					expect(obj.length).to.be.equal(reconstructed.length);
					expect(obj.toString()).to.be.equal(reconstructed.toString());
					expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
				});
		
				it('should serialize an async function', function() {
					const obj = async function(arg) {
						return await `Hello, ${arg}`;
					};
					const reconstructed = reconstruct(ser, obj);
					// deep-eql does not seem to be able to compare functions directly
					expect(reconstructed).to.be.instanceof(Function);
					expect(obj.name).to.be.equal(reconstructed.name);
					expect(obj.length).to.be.equal(reconstructed.length);
					expect(obj.toString()).to.be.equal(reconstructed.toString());
					expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
				});
		
				it('should serialize a generator function', function() {
					const obj = function*(arg) {
						yield `Hello, ${arg}`;
					};
		
					const reconstructed = reconstruct(ser, obj);
					// deep-eql does not seem to be able to compare functions directly
					expect(reconstructed).to.be.instanceof(Function);
					expect(obj.name).to.be.equal(reconstructed.name);
					expect(obj.length).to.be.equal(reconstructed.length);
					expect(obj.toString()).to.be.equal(reconstructed.toString());
					expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
				});
		
				it('should serialize an async generator function', function() {
					const obj = async function*(arg) {
						yield `Hello, ${arg}`;
					};
		
					const reconstructed = reconstruct(ser, obj);
					// deep-eql does not seem to be able to compare functions directly
					expect(reconstructed).to.be.instanceof(Function);
					expect(obj.name).to.be.equal(reconstructed.name);
					expect(obj.length).to.be.equal(reconstructed.length);
					expect(obj.toString()).to.be.equal(reconstructed.toString());
					expect(Object.prototype.toString.call(obj)).to.equal(Object.prototype.toString.call(reconstructed));
				});
		
				it('should not serialize a native function', function() {
					const obj = eval;
		
					expect(function() {
						return ser.serialize(obj);
					}).to.throw();
				});
			});
		
			describe('classes', function() {
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
		
				const ser = new yas.yaserializer([Color, Vehicle]);
		
				it('should preserve old-style classes', function() {
					function Shape(x, y) {
						this.x = x;
						this.y = y;
					}
					Shape.prototype.move = function(x, y) {
						this.x += x;
						this.y += y;
					};
		
					function Circle(x, y, r) {
						Shape.call(this, x, y);
						this.r = r;
					}
		
					Circle.prototype = Object.create(Shape.prototype);
					Circle.prototype.constructor = Circle;
		
					Circle.prototype.area = function() {
						return this.r * 2 * Math.PI;
					};
		
					let obj1 = new Circle(1, 2, 3);
					let obj2 = new Shape(4, 5);
		
					const cser = new yas.yaserializer([Shape, Circle]);
		
					let reconstructed1 = reconstruct(cser, obj1);
					let reconstructed2 = reconstruct(cser, obj2);
		
					expect(obj1).to.be.deep.equal(reconstructed1);
					expect(obj2).to.be.deep.equal(reconstructed2);
				});
		
				it('should preserve object classes', function() {
					const obj = new Vehicle();
		
					const reconstructed = reconstruct(ser, obj);
					expect(reconstructed).to.be.instanceof(Vehicle);
					expect(obj).to.be.deep.equal(reconstructed);
				});
		
				it('should let me mix ES5 and ES6 classes', function() {
					function Shape(x, y) {
						this.x = x;
						this.y = y;
					}
					Shape.prototype.move = function(x, y) {
						this.x += x;
						this.y += y;
					};
		
					function Circle(x, y, r) {
						Shape.call(this, x, y);
						this.r = r;
					}
		
					Circle.prototype = Object.create(Shape.prototype);
					Circle.prototype.constructor = Circle;
		
					Circle.prototype.area = function() {
						return this.r * 2 * Math.PI;
					};
		
					class RedCircle extends Circle {
						constructor(...args) {
							super(...args);
		
							this.colour = 'red';
						}
					}
		
					let obj1 = new Circle(1, 2, 3);
					let obj2 = new Shape(4, 5);
					let obj3 = new RedCircle(6, 7, 8);
		
					const cser = new yas.yaserializer([Shape, Circle, RedCircle]);
		
					let reconstructed1 = reconstruct(cser, obj1);
					let reconstructed2 = reconstruct(cser, obj2);
					let reconstructed3 = reconstruct(cser, obj3);
		
					expect(obj1).to.be.deep.equal(reconstructed1);
					expect(obj2).to.be.deep.equal(reconstructed2);
					expect(obj3).to.be.deep.equal(reconstructed3);
				});
		
				it('should preserve Symbol-identified properties', function() {
					const global_symbol = Symbol.for('yas');
					const obj = {
						// regular property
						[Symbol.species]: 1,
		
						// regular method
						[Symbol.match]() {
							return 2;
						},
		
						// getter
						get [Symbol.hasInstance]() {
							return 3;
						},
		
						// setter
						set [global_symbol](x) {
							console.log(x);
						},
		
						// annoying function
						async *[Symbol.unscopables]() {
							yield 5;
						},
		
						//computed
						['a' + 'b']: 6
					};
		
					const reconstructed = reconstruct(ser, obj);
		
					expect(obj).to.be.deep.equal(reconstructed);
					expect(obj[Symbol.toStringTag]).to.be.deep.equal(reconstructed[Symbol.toStringTag]);
				});

				it('should preserve arrays of objects', function() {
					const obj = [new Vehicle(), new Vehicle()];
					obj[0].brand = 'Renault';
					obj[0].price = 95000;
					obj[0].created_on = new Date('Wed, 04 May 1949 22:00:00 GMT');
		
					const reconstructed = reconstruct(ser, obj);
					expect(obj).to.be.deep.equal(reconstructed);
				});
		
				it('should preserve object identity in arrays', function() {
					const the_vehicle = new Vehicle();
					the_vehicle.brand = 'Citroen';
					the_vehicle.price = 95000;
					the_vehicle.created_on = new Date('Wed, 04 May 1949 22:00:00 GMT');
		
					const obj = [the_vehicle, the_vehicle];
					const reconstructed = reconstruct(ser, obj);
		
					expect(obj).to.be.deep.equal(reconstructed);
					expect(reconstructed[0]).to.be.equal(reconstructed[1]);
				});
		
				it('should preserve identity in conjunction with built-in types', function() {
					const obj = new Map();
					const entry = ['a', ['b', 'c']];
					obj.set('d', entry);
					obj.set('e', entry);
		
					const reconstructed = reconstruct(ser, obj);
					expect(obj).to.be.deep.equal(reconstructed);
				});

				it('should preserve properties on classes', function() {
					class Rectangle {
						constructor() {
							this.width = 10;
							this.height = 20;
		
							Object.defineProperty(this, 'area', {
								get: function() {
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
		
					const rser = new yas.yaserializer([Rectangle]);
		
					var obj = new Rectangle();
					obj.width = 10;
					obj.height = 10;
					expect(obj.area).to.be.equal(100);
					expect(obj.perimeter).to.be.equal(40);
		
					const reconstructed = reconstruct(rser, obj);
		
					expect(obj).to.be.deep.equal(reconstructed);
		
					reconstructed.width = 20;
					expect(reconstructed.area).to.be.equal(200);
					expect(reconstructed.perimeter).to.be.equal(60);
				});
		
				it('should preserve properties on naked objects', function() {
					const obj = {
						get normal() {
							return 1;
						}
					};
		
					const reconstructed = reconstruct(ser, obj);
		
					expect(obj).to.be.deep.equal(reconstructed);
					expect(obj.normal).to.be.deep.equal(reconstructed.normal);
				});
		
				it('should preserve typed arrays', function() {
					const obj = {
						float32: new Float32Array([1.1, 2.2, 3.3, 5.5, 6.6, 10.01, 100.001]),
						uint32: new Int32Array([1, 2, 3, 5, 6, 10, 100])
					};
		
					const reconstructed = reconstruct(ser, obj);
					expect(obj).to.be.deep.equal(reconstructed);
				});
		
				it('should preserve DataViews', function() {
					const obj = new DataView(new ArrayBuffer(16));
					obj.setUint32(0, 0xdeadbeef, true);
					obj.setUint32(4, 0xcafebabe, true);
					obj.setUint32(8, 0xcafebeef, true);
					obj.setUint32(12, 0xdeadbabe, true);
		
					const reconstructed = reconstruct(ser, obj);
					expect(obj).to.be.deep.equal(reconstructed);
				});
		
				it('should properly handle extensions of the extensible built-in types', function() {
					class XObject extends Object {
						constructor(...args) {
							super(...args);
							this.extension = 1;
						}
					}
					class XString extends String {
						constructor(...args) {
							super(...args);
							this.extension = 1;
						}
					}
					class XFunction extends Function {
						constructor(...args) {
							super(...args);
							this.extension = 1;
						}
					}
					class XArray extends Array {
						constructor(...args) {
							super(...args);
							this.extension = 1;
						}
					}
					class XNumber extends Number {
						constructor(...args) {
							super(...args);
							this.extension = 1;
						}
					}
					class XError extends Error {
						constructor(...args) {
							super(...args);
							this.extension = 1;
						}
					}
					class XRegExp extends RegExp {
						constructor(...args) {
							super(...args);
							this.extension = 1;
						}
					}
					class XBoolean extends Boolean {
						constructor(...args) {
							super(...args);
							this.extension = 1;
						}
					}
					class XMap extends Map {
						constructor(...args) {
							super(...args);
							this.extension = 1;
						}
					}
					class XSet extends Set {
						constructor(...args) {
							super(...args);
							this.extension = 1;
						}
					}
					class XDate extends Date {
						constructor(...args) {
							super(...args);
							this.extension = 1;
						}
					}
					class XArrayBuffer extends ArrayBuffer {
						constructor(...args) {
							super(...args);
							this.extension = 1;
						}
					}
					class XFloat32Array extends Float32Array {
						constructor(...args) {
							super(...args);
							this.extension = 1;
						}
					}
					class XDataView extends DataView {
						constructor(...args) {
							super(...args);
							this.extension = 1;
						}
					}
					const xser = new yas.yaserializer([XObject, XString, XFunction, XArray, XNumber, XError, XRegExp, XBoolean, XMap, XSet, XDate, XArrayBuffer, XFloat32Array, XDataView]);
		
					{
						const xab = new XArrayBuffer(16);
						const xdv = new XDataView(xab);
						xdv.setUint32(0, 0xdeadbeef, true);
						xdv.setUint32(4, 0xcafebabe, true);
						xdv.setUint32(8, 0xcafebeef, true);
						xdv.setUint32(12, 0xdeadbabe, true);
						const xa = XArray.from([1, 2, , 4, 5]);
						delete xa[2];
		
						const obj = [
							new XObject(),
							new XString('str'),
							xa,
							new XNumber(3),
							new XRegExp(/\w+/g),
							new XBoolean(true),
							new XMap([['a', 2], ['c', 4], ['z', 6], ['A', 12]]),
							new XSet([1, '2', 3]),
							new XDate(),
							xab,
							new XFloat32Array([1.1, 2.2, 3.3, 5.5, 6.6, 10.01, 100.001]),
							xdv
						];
		
						const reconstructed = reconstruct(xser, obj);
						expect(obj).to.be.deep.equal(reconstructed);
		
						obj.forEach((value, idx) => {
							expect(Object.prototype.toString.call(obj[idx])).to.equal(Object.prototype.toString.call(reconstructed[idx]));
						});
					}
					{
						const obj = [new XFunction('a', 'return a;'), new XError('msg')];
		
						// deep-eql does not seem to be able to compare functions directly
						const reconstructed = reconstruct(xser, obj);
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
		
			describe('options change serialization and deserialization behaviour', function() {
				it('should not preserve ignored members', function() {
					class ExcludedMembers {
						constructor() {
							this.name = 'always included';
							this.$invocation_ignored = 'excluded by invocation options';
							this.$class_ignored = 'excluded by class options';
							this.$global_ignored = 'excluded by global options';
							this._cache = [];
							this.$someOtherStuff = 0;
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
		
					expect('always included').to.be.equal(reconstructed.name);
					expect(reconstructed.$invocation_ignored).to.be.an('undefined');
					expect(reconstructed.$class_ignored).to.be.an('undefined');
					expect(reconstructed.$serial_ignored).to.be.an('undefined');
				});
		
				it('should run on_deserialize during deserialization', function() {
					class DeserializeAction {
						constructor() {
							this.name = 'unset';
							this._cache = [];
						}
		
						rebuild_cache() {
							if (this._cache === undefined) {
								this._cache = [];
							}
							this._cache.push('rebuild_cache has been called');
						}
					}
		
					const ser = new yas.yaserializer([]);
					const class_options = {
						ignore: ['_cache'],
						on_deserialize: (obj) => {
							obj.rebuild_cache();
						}
					};
		
					ser.make_class_serializable(DeserializeAction, class_options);
		
					const obj = new DeserializeAction();
					obj._cache.push(36);
		
					const reconstructed = reconstruct(ser, obj);
					expect(reconstructed._cache).to.be.deep.equal(['rebuild_cache has been called']);
				});
		
				it('should run on_post_deserialize after deserialization', function() {
					class PostDeserializeAction {
						constructor() {
							this.name = 'unset';
							this._cache = [];
						}
		
						rebuild_cache() {
							if (this._cache === undefined) {
								this._cache = [];
							}
							this._cache.push('rebuild_cache has been called');
						}
					}
		
					const ser = new yas.yaserializer();
					const options = {
						ignore: ['_cache'],
						on_post_deserialize: (obj) => {
							obj.rebuild_cache();
						}
					};
					ser.make_class_serializable(PostDeserializeAction, options);
		
					const obj = new PostDeserializeAction();
					obj._cache.push(36);
		
					const reconstructed = reconstruct(ser, obj);
					expect(reconstructed._cache).to.be.deep.equal(['rebuild_cache has been called']);
				});
			});
		
			describe('general utility', function() {
				it('should let me perform final encoding in different ways', function() {
					const BSON = require('bson');
					const instance_options = {
						perform_encode: function(obj) { return BSON.serialize({'a':obj});},
						perform_decode: function(obj) { return BSON.deserialize(obj).a; }
					};
					const bser = new yas.yaserializer([], instance_options);
		
					const obj = { d: new Date(), s: 'string', arr: [1, 2, 3] };
		
					const reconstructed = reconstruct(bser, obj);
					expect(reconstructed).to.be.deep.equal(obj);
				});
		
				it('should let me perform final encoding in more complex ways', function() {
					const BSON = require('bson');
					const zlib = require('zlib');
					const instance_options = {
						perform_encode: function(obj) {
							const serial_form = BSON.serialize({'a':obj});
							return zlib.deflateSync(serial_form);
						},
						perform_decode: function(obj) {
							const serial_form = zlib.inflateSync(obj);
							return BSON.deserialize(serial_form).a;
						}
					};
					const bcer = new yas.yaserializer([], instance_options);
		
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
							this.cache = [{'a': 1234n}];
							this.version = 1;
						}
		
						//	@serializer
						static serialize(obj, deeper) {
							return [
								{
									'x': obj.field + ' serialized from',
									'y': obj.cache
								},
								false
							];
						}
		
						//	@deserializer
						static deserialize(structured, destructured, deeper) {
							structured.field = destructured.x + ' reconstituted';
							structured.cache = destructured.y;
							return false;
						}
		
						// 	@deserialize_action
						rebuild() {
							this.version = 20;
						}
					}
					const obj = new Test();
		
					Reflect.decorate([yas.serializable], Test);
					Reflect.decorate([yas.unserializable], obj, 'cache');
					Reflect.decorate([yas.unserializable], obj, 'version');
					Reflect.decorate([yas.serializer], Test, 'serialize');
					Reflect.decorate([yas.deserializer], Test, 'deserialize');
					Reflect.decorate([yas.deserialize_action], obj, 'rebuild');
		
					const serialized_form = new yas.yaserializer([]).serialize(obj, { use_packed_format: true });
					const reconstructed = new yas.yaserializer([]).deserialize(serialized_form, { use_packed_format: true });
		
					expect(reconstructed.version).to.be.equal(20);
					expect(reconstructed.field).to.be.equal('Hello, world! serialized from reconstituted');
					expect(reconstructed).to.be.instanceof(Test);
				});
			});
		});
	});
})();
