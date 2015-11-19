'use strict';


var Ajv = require(typeof window == 'object' ? 'ajv' : '../lib/ajv')
  , should = require('chai').should();


describe('Validation errors', function () {
  var ajv, ajvJP, fullAjv;

  beforeEach(function() {
    createInstances();
  });

  function createInstances(errorDataPath) {
    ajv = Ajv({ errorDataPath: errorDataPath });
    ajvJP = Ajv({ errorDataPath: errorDataPath, jsonPointers: true });
    fullAjv = Ajv({ errorDataPath: errorDataPath, allErrors: true, jsonPointers: true });
  }

  it('error should include dataPath', function() {
    testSchema1({
      properties: {
        foo: { type: 'number' }
      }
    });
  });

  it('error should include dataPath in refs', function() {
    testSchema1({
      definitions: {
        num: { type: 'number' }
      },
      properties: {
        foo: { $ref: '#/definitions/num' }
      }
    });
  });


  it('errors for additionalProperties should include property in dataPath', function() {
    var schema = {
      properties: {
        foo: {},
        bar: {}
      },
      additionalProperties: false
    };

    var data = { foo: 1, bar: 2 }
      , invalidData = { foo: 1, bar: 2, baz: 3, quux: 4 };

    var validate = ajv.compile(schema);
    shouldBeValid(validate, data);
    shouldBeInvalid(validate, invalidData);
    shouldBeError(validate.errors[0], 'additionalProperties', "['baz']");

    var validateJP = ajvJP.compile(schema);
    shouldBeValid(validateJP, data);
    shouldBeInvalid(validateJP, invalidData);
    shouldBeError(validateJP.errors[0], 'additionalProperties', "/baz");

    var fullValidate = fullAjv.compile(schema);
    shouldBeValid(fullValidate, data);
    shouldBeInvalid(fullValidate, invalidData, 2);
    shouldBeError(fullValidate.errors[0], 'additionalProperties', '/baz');
    shouldBeError(fullValidate.errors[1], 'additionalProperties', '/quux');

    fullValidate.errors
    .filter(function(err) { return err.keyword == 'additionalProperties'; })
    .map(function(err) { return fullAjv.opts.jsonPointers ? err.dataPath.substr(1) : err.dataPath.slice(2,-2); })
    .forEach(function(p) { delete invalidData[p]; });

    invalidData .should.eql({ foo: 1, bar: 2 });
  });


  it('with option errorDataPath="property" errors for required should include missing property in dataPath', function() {
    createInstances('property');
    testRequired('property');
  });


  it('without option errorDataPath errors for required should NOT include missing property in dataPath', function() {
    testRequired();
  });


  function testRequired(errorDataPath) {
    var schema = {
      required: ['foo', 'bar', 'baz']
    };

    var data = { foo: 1, bar: 2, baz: 3 }
      , invalidData1 = { foo: 1, baz: 3 }
      , invalidData2 = { bar: 2 };

    var validate = ajv.compile(schema);
    shouldBeValid(validate, data);
    shouldBeInvalid(validate, invalidData1);
    shouldBeError(validate.errors[0], 'required', path('.bar'), msg('.bar'));
    shouldBeInvalid(validate, invalidData2);
    shouldBeError(validate.errors[0], 'required', path('.foo'), msg('.foo'));

    var validateJP = ajvJP.compile(schema);
    shouldBeValid(validateJP, data);
    shouldBeInvalid(validateJP, invalidData1);
    shouldBeError(validateJP.errors[0], 'required', path('/bar'), msg('bar'));
    shouldBeInvalid(validateJP, invalidData2);
    shouldBeError(validateJP.errors[0], 'required', path('/foo'),  msg('foo'));

    var fullValidate = fullAjv.compile(schema);
    shouldBeValid(fullValidate, data);
    shouldBeInvalid(fullValidate, invalidData1);
    shouldBeError(fullValidate.errors[0], 'required', path('/bar'), msg('.bar'));
    shouldBeInvalid(fullValidate, invalidData2, 2);
    shouldBeError(fullValidate.errors[0], 'required', path('/foo'), msg('.foo'));
    shouldBeError(fullValidate.errors[1], 'required', path('/baz'), msg('.baz'));

    function path(dataPath) {
      return errorDataPath == 'property' ? dataPath : '';
    }

    function msg(prop) {
      return errorDataPath == 'property'
              ? 'is a required property'
              : 'should have required property ' + prop;
    }
  }


  it('required validation and errors for large data/schemas with option errorDataPath="property"', function() {
    createInstances('property');
    testRequiredLargeSchema('property');
  });


  it('required validation and errors for large data/schemas WITHOUT option errorDataPath="property"', function() {
    testRequiredLargeSchema();
  });


  function testRequiredLargeSchema(errorDataPath) {
    var schema = { required: [] }
      , data = {}
      , invalidData1 = {}
      , invalidData2 = {};
    for (var i=0; i<100; i++) {
      schema.required.push(''+i); // properties from '0' to '99' are required
      data[i] = invalidData1[i] = invalidData2[i] = i;
    }

    delete invalidData1[1]; // property '1' will be missing
    delete invalidData2[2]; // properties '2' and '198' will be missing
    delete invalidData2[98];

    var validate = ajv.compile(schema);
    shouldBeValid(validate, data);
    shouldBeInvalid(validate, invalidData1);
    shouldBeError(validate.errors[0], 'required', path("['1']"), msg("'1'"));
    shouldBeInvalid(validate, invalidData2);
    shouldBeError(validate.errors[0], 'required', path("['2']"), msg("'2'"));

    var validateJP = ajvJP.compile(schema);
    shouldBeValid(validateJP, data);
    shouldBeInvalid(validateJP, invalidData1);
    shouldBeError(validateJP.errors[0], 'required', path("/1"), msg("'1'"));
    shouldBeInvalid(validateJP, invalidData2);
    shouldBeError(validateJP.errors[0], 'required', path("/2"), msg("'2'"));

    var fullValidate = fullAjv.compile(schema);
    shouldBeValid(fullValidate, data);
    shouldBeInvalid(fullValidate, invalidData1);
    shouldBeError(fullValidate.errors[0], 'required', path('/1'), msg("'1'"));
    shouldBeInvalid(fullValidate, invalidData2, 2);
    shouldBeError(fullValidate.errors[0], 'required', path('/2'), msg("'2'"));
    shouldBeError(fullValidate.errors[1], 'required', path('/98'), msg("'98'"));

    function path(dataPath) {
      return errorDataPath == 'property' ? dataPath : '';
    }

    function msg(prop) {
      return errorDataPath == 'property'
              ? 'is a required property'
              : 'should have required property ' + prop;
    }
  }


  it('errors for items should include item index without quotes in dataPath (#48)', function() {
    var schema1 = {
      id: 'schema1',
      type: 'array',
      items: {
        type: 'integer',
        minimum: 10
      }
    };

    var data = [ 10, 11, 12]
      , invalidData1 = [ 1, 10 ]
      , invalidData2 = [ 10, 9, 11, 8, 12];

    var validate = ajv.compile(schema1);
    shouldBeValid(validate, data);
    shouldBeInvalid(validate, invalidData1);
    shouldBeError(validate.errors[0], 'minimum', '[0]', 'should be >= 10');
    shouldBeInvalid(validate, invalidData2);
    shouldBeError(validate.errors[0], 'minimum', '[1]', 'should be >= 10');

    var validateJP = ajvJP.compile(schema1);
    shouldBeValid(validateJP, data);
    shouldBeInvalid(validateJP, invalidData1);
    shouldBeError(validateJP.errors[0], 'minimum', '/0', 'should be >= 10');
    shouldBeInvalid(validateJP, invalidData2);
    shouldBeError(validateJP.errors[0], 'minimum', '/1', 'should be >= 10');

    var fullValidate = fullAjv.compile(schema1);
    shouldBeValid(fullValidate, data);
    shouldBeInvalid(fullValidate, invalidData1);
    shouldBeError(fullValidate.errors[0], 'minimum', '/0', 'should be >= 10');
    shouldBeInvalid(fullValidate, invalidData2, 2);
    shouldBeError(fullValidate.errors[0], 'minimum', '/1', 'should be >= 10');
    shouldBeError(fullValidate.errors[1], 'minimum', '/3', 'should be >= 10');

    var schema2 = {
      id: 'schema2',
      type: 'array',
      items: [{ minimum: 10 }, { minimum: 9 }, { minimum: 12 }]
    };

    var validate = ajv.compile(schema2);
    shouldBeValid(validate, data);
    shouldBeInvalid(validate, invalidData1);
    shouldBeError(validate.errors[0], 'minimum', '[0]', 'should be >= 10');
    shouldBeInvalid(validate, invalidData2);
    shouldBeError(validate.errors[0], 'minimum', '[2]', 'should be >= 12');
  });


  function testSchema1(schema) {
    _testSchema1(ajv, schema);
    _testSchema1(ajvJP, schema);
    _testSchema1(fullAjv, schema)
  }


  function _testSchema1(ajv, schema) {
    var data = { foo: 1 }
      , invalidData = { foo: 'bar' };

    var validate = ajv.compile(schema);
    shouldBeValid(validate, data);
    shouldBeInvalid(validate, invalidData);
    shouldBeError(validate.errors[0], 'type', ajv.opts.jsonPointers ? '/foo' : '.foo');
  }


  function shouldBeValid(validate, data) {
    validate(data) .should.equal(true);
    should.equal(validate.errors, null);
  }


  function shouldBeInvalid(validate, data, numErrors) {
    validate(data) .should.equal(false);
    should.equal(validate.errors.length, numErrors || 1)
  }


  function shouldBeError(error, keyword, dataPath, message) {
    error.keyword .should.equal(keyword);
    error.dataPath .should.equal(dataPath);
    error.message .should.be.a('string');
    if (message !== undefined)
      error.message .should.equal(message);
  }
});
