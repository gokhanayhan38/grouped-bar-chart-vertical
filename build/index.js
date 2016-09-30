"use strict";

const { EventEmitterMixin } = require("event-emitter-mixin");
const React = require("react"),
      Component = EventEmitterMixin(React.Component),
      PropTypes = React.PropTypes;
const ReactDOM = require("react-dom");
const d3 = require("d3");
const autoIncrement = require("autoincrement");
const toPx = require("@yavuzmester/css-length-to-px");
const _ = require("underscore");
const calculatePercentage = (value, total) => Number((100 * value / total).toFixed(2));
const reverse = arr => _.map(arr, (a, aIdx) => arr[arr.length - aIdx - 1]);

const propTypes = {
    title: PropTypes.string,
    divHeight: PropTypes.number.isRequired,
    svgMargin: PropTypes.shape({
        left: PropTypes.number.isRequired,
        right: PropTypes.number.isRequired,
        top: PropTypes.number.isRequired,
        bottom: PropTypes.number.isRequired
    }).isRequired,
    data: PropTypes.arrayOf(PropTypes.shape({
        category: PropTypes.string.isRequired,
        value: PropTypes.number.isRequired,
        color: PropTypes.string.isRequired
    }).isRequired).isRequired,
    selection: PropTypes.arrayOf(PropTypes.string.isRequired).isRequired
};

const defaultProps = {
    title: "",
    colors: []
};

/**
 * A note for selection.on usage in D3:
 *   If an event listener was already registered for the same type on the selected element,
 *   the existing listener is removed before the new listener is added.
 *   We are calling selection.on multiple times (at componentDidUpdate)
 *   and it does not cause the callback to be called multiple times (that"s what we want there).
 */
class GroupedBarChartHorizontal extends Component {
    constructor(props) {
        super(props);
        this.onBarClicked = this.onBarClicked.bind(this);
        this.onTitleClicked = this.onTitleClicked.bind(this);
    }

    colors() {
        const { data } = this.props;
        return _.uniq(data.map(d => d.color));
    }

    numOfGroups() {
        return this.colors().length;
    }

    groupTotals() /*: object */{
        const { data } = this.props;

        const groupedData /*: object */ = _.groupBy(data, d => d.color);

        return Object.keys(groupedData).reduce((memo, color) => {
            const groupData /*: array<object> */ = groupedData[color];
            memo[color] = groupData.reduce((memo, gd) => memo + gd.value, 0);
            return memo;
        }, {});
    }

    data() /*: array<object> */{
        const { data } = this.props;
        return data;
    }

    svgHeight() /*: number */{
        const { divHeight, svgMargin } = this.props;
        return divHeight - svgMargin.top - svgMargin.bottom;
    }

    categories() /*: array<string> */{
        const data = this.data();
        return _.uniq(data.map(d => d.category));
    }

    numOfCategories() /*: number */{
        return this.categories().length;
    }

    svgWidth() /*: number */{
        const { colors } = this.props,
              numOfCategories = this.numOfCategories(),
              numOfGroups = this.numOfGroups(),
              barWidth = toPx(GroupedBarChartHorizontal.barWidthScale(numOfGroups));

        return numOfCategories * barWidth * numOfGroups;
    }

    divWidth() /*: number */{
        const { svgMargin } = this.props,
              svgWidth = this.svgWidth();

        return svgMargin.left + svgWidth + svgMargin.right;
    }

    barColor(datum /*: object */) /*: string */{
        const { selection } = this.props;
        return selection.includes(datum.category) ? datum.color : "gray";
    }

    categoryTitleColor(category /*: string */) /*: string */{
        const { selection } = this.props;
        return selection.includes(category) ? "white" : "gray";
    }

    x0Domain() /*: array<string> */{
        const data = this.data();
        return data.map(d => d.category);
    }

    x0Scale() /*: function */{
        const x0Domain = this.x0Domain(),
              xRange = this.xRange();

        return d3.scaleBand().domain(x0Domain).rangeRound(xRange).padding(0.05);
    }

    x1Domain() /*: array<string> */{
        const data = this.data();
        return _.uniq(data.map(d => d.color));
    }

    x1Scale() /*: function */{
        const x1Domain = this.x1Domain(),
              x0Scale = this.x0Scale();

        return d3.scaleBand().domain(x1Domain).rangeRound([0, x0Scale.bandwidth()]);
    }

    xRange() /*: array<number> */{
        const svgWidth = this.svgWidth();
        return [0, svgWidth];
    }

    xAxis() /*: function */{
        const x0Scale = this.x0Scale();

        return d3.axisBottom(x0Scale).ticks(3, ",.0s");
    }

    yDomain() /*: array<number> */{
        const data = this.data();
        return [0, d3.max(data, d => d.value)];
    }

    yRange() /*: array<number> */{
        const svgHeight = this.svgHeight();
        return [0, svgHeight];
    }

    yScale() /*: function */{
        const yDomain = this.yDomain(),
              yRange = this.yRange();

        return d3.scaleLinear().domain(yDomain).range(yRange);
    }

    yAxis() /*: function */{
        const yDomain = this.yDomain(),
              yRange = this.yRange();

        //return d3.scaleLinear().domain(yDomain).range(reverse(yRange));

        //
        const yScale = this.yScale();
        //return d3.axisLeft(v => -1 * yScale.call(this, v));
        return d3.axisLeft(d3.scaleLinear().domain(yDomain).range(reverse(yRange)));
        //return d3.axisLeft(yScale).ticks(3, ",.0s");

        //return d3.axisLeft(yScale);
    }

    render() {
        const data = this.data(),
              { title, divHeight, svgMargin } = this.props,
              divWidth = this.divWidth(),
              svgHeight = this.svgHeight(),
              x0Scale = this.x0Scale(),
              x1Scale = this.x1Scale(),
              yScale = this.yScale();

        return (
            /* Margin convention in D3: https://gist.github.com/mbostock/3019563 */
            React.createElement(
                "div",
                { className: "category-chart" },
                React.createElement(
                    "svg",
                    { width: divWidth, height: divHeight },
                    React.createElement(
                        "g",
                        { className: "margin axis", transform: "translate(" + svgMargin.left + "," + svgMargin.top + ")" },
                        React.createElement(
                            "g",
                            { className: "x axis", transform: "translate(0," + svgHeight + ")" },
                            data.map(d => {
                                return React.createElement(
                                    "rect",
                                    { key: autoIncrement,
                                        className: "bar",
                                        x: x0Scale(d.category) + x1Scale(d.color),
                                        y: -1 * yScale(d.value),
                                        width: x1Scale.bandwidth(),
                                        height: yScale(d.value),
                                        style: { fill: this.barColor(d) },
                                        onClick: e => this.onBarClicked(Object.assign({ category: d.category }, e)) },
                                    React.createElement(
                                        "title",
                                        null,
                                        d.value
                                    )
                                );
                            })
                        ),
                        React.createElement("g", { className: "y axis", transform: "translate(0,0)" }),
                        React.createElement(
                            "text",
                            { y: "-5", onClick: this.onTitleClicked },
                            React.createElement(
                                "tspan",
                                { className: "category-chart-title" },
                                title
                            ),
                            React.createElement(
                                "title",
                                null,
                                "Click title to toggle between alphabetical and numerical sorting."
                            )
                        )
                    )
                )
            )
        );
    }

    componentDidMount() {
        this.componentDidMountOrUpdate();
    }

    componentDidUpdate() {
        this.componentDidMountOrUpdate();
    }

    componentDidMountOrUpdate() {
        const data = this.data(),
              xAxis = this.xAxis(),
              yAxis = this.yAxis();

        const marginAxisNode = d3.select(ReactDOM.findDOMNode(this)).select("g.margin.axis"),
              xAxisNode = marginAxisNode.select("g.x.axis"),
              yAxisNode = marginAxisNode.select("g.y.axis");

        //update axes
        xAxisNode.call(xAxis);
        yAxisNode.call(yAxis);

        //make the y axis labels clickable
        //yAxisNode.selectAll(".tick").on("click", category => this.onBarClicked(Object.assign({category: category}, d3.event)));

        //adjust the y axis label colors (Caution: avoid nested selections in d3, as it expects the data to be nested as well)
        //yAxisNode.selectAll(".tick text").data(this.categories()).
        //    style("fill", category => this.categoryTitleColor(category)).html(category => category );
    }

    onBarClicked(e /*: object */) {
        const { shiftKey /*: boolean */, category /*: string */ } = e,
              { selection } = this.props;

        const newSelection = shiftKey ? _.without(selection, category) : selection.concat([category]);

        this.emit("bar-click", { newSelection: newSelection });
    }

    onTitleClicked() {
        this.emit("title-click");
    }
} //end of GroupedBarChartHorizontal component def

GroupedBarChartHorizontal.propTypes = propTypes;
GroupedBarChartHorizontal.defaultProps = defaultProps;

GroupedBarChartHorizontal.barWidthScale = d3.scaleLinear().domain([1, 11]).range(["2.5ch", "0.5ch"]).clamp(true);

module.exports = GroupedBarChartHorizontal;
