"use strict";

const React = require("react");
const GroupedBarChartVertical = require("..");
const ReactTestUtils = require("react-addons-test-utils");
const assert = require("assert");

describe("<GroupedBarChartVertical/>", function() {
    it("shouldnt render", function() {
        const renderer = ReactTestUtils.createRenderer();
        const result = renderer.getRenderOutput(React.createElement(GroupedBarChartVertical));

        assert.strictEqual(result, null);
    });
});
