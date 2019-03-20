var lib = require('./dist/cerealizer.js');

function cerealizer(known_classes, options) {
	const the_cerealizer = new lib.cerealizer(known_classes, options);
	
	this.make_class_serializable = function(clazz, options, srlz, dsrlz) {
		return the_cerealizer.make_class_serializable(clazz, options, srlz, dsrlz);
	}
	
	this.serialize = function(structured, options) {
		return the_cerealizer.serialize(structured, options);
	}
	
	this.deserialize = function(unstructured, options) {
		return the_cerealizer.deserialize(unstructured, options);
	}
	
	this.clone = function(structured, options) {
		return the_cerealizer.deserialize(the_cerealizer.serialize(structured, options), options);
	}
};

exports.cerealizer = cerealizer;
exports.cerealizer_options = lib.cerealizer_options;
exports.serializable = lib.serializable;
exports.unserializable = lib.unserializable;
exports.deserialize_action = lib.deserialize_action;
