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

const propTypes = {
    title: PropTypes.string,
    divWidth: PropTypes.number.isRequired,
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
    categoryTitles: PropTypes.arrayOf(PropTypes.shape({
        category: PropTypes.string.isRequired,
        categoryTitle: PropTypes.string.isRequired
    })),
    showPercentageValue: PropTypes.bool,
    logScale: PropTypes.bool,
    selection: PropTypes.arrayOf(PropTypes.string.isRequired).isRequired
};

const defaultProps = {
    title: "",
    colors: [],
    categoryTitles: [],
    showPercentageValue: false,
    logScale: false
};

/**
 * A note for selection.on usage in D3:
 *   If an event listener was already registered for the same type on the selected element,
 *   the existing listener is removed before the new listener is added.
 *   We are calling selection.on multiple times (at componentDidUpdate)
 *   and it does not cause the callback to be called multiple times (that"s what we want there).
 */
class GroupedBarChartVertical extends Component {
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
        const { data, showPercentageValue } = this.props;

        if (!showPercentageValue) {
            return data;
        } else {
            const groupTotals = this.groupTotals();

            return data.map(d => {
                const total = groupTotals[d.color];
                return Object.assign({ percentageValue: calculatePercentage(d.value, total) }, d);
            });
        }
    }

    svgHeight() /*: number */{
        const { divWidth, svgMargin } = this.props;
        return divWidth - svgMargin.left - svgMargin.right;
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
              barHeight = toPx(GroupedBarChartVertical.barHeightScale(numOfGroups));

        return numOfCategories * barHeight * numOfGroups;
    }

    divHeight() /*: number */{
        const { svgMargin } = this.props,
              svgHeight = this.svgHeight();

        return svgMargin.top + svgHeight + svgMargin.bottom;
    }

    barColor(datum /*: object */) /*: string */{
        const { selection } = this.props;
        return selection.includes(datum.category) ? datum.color : "gray";
    }

    categoryTitle(category /*: string */) /*: string */{
        const { categoryTitles } = this.props,
              categoryTitleObj = categoryTitles && categoryTitles.find(ct => ct.category === category);

        return categoryTitleObj ? categoryTitleObj.categoryTitle : category;
    }

    categoryTitleColor(category /*: string */) /*: string */{
        const { selection } = this.props;
        return selection.includes(category) ? "white" : "gray";
    }

    x0Domain() /*: array<number> */{
        // x0
        const data = this.data();
        return data.map(d => d.category);
    }

    x0Scale() /*: function */{
        const x0Domain = this.x0Domain(),
              xRange = this.xRange();

        return d3.scaleBand().domain(x0Domain).rangeRound(xRange).padding(0.05);
    }

    x1Domain() /*: array<number> */{
        // x0
        const data = this.data();
        return _.uniq(data.map(d => d.color));
    }

    x1Scale() /*: function */{
        const x1Domain = this.x1Domain(),
              x0Scale = this.x0Scale();

        return d3.scaleBand().domain(x1Domain).rangeRound([0, x0Scale.bandwidth()]);
    }

    xRange() /*: array<number> */{
        // x0
        const svgWidth = this.svgWidth();
        return [0, svgWidth];
        //return [svgWidth, 0];
    }

    xAxis() /*: function */{
        const x0Scale = this.x0Scale();
        return d3.axisBottom(x0Scale);
    }

    yDomain() /*: array<string> */{
        const data = this.data(),
              { showPercentageValue, logScale } = this.props;

        //return [d3.max(data, d => showPercentageValue ? d.percentageValue : d.value) , !logScale ? 0 : 1];
        return [0, d3.max(data, d => showPercentageValue ? d.percentageValue : d.value)];
    }

    yScale() /*: function */{
        const { logScale } = this.props,
              yDomain = this.yDomain(),
              yRange = this.yRange();

        if (!logScale) {
            return d3.scaleLinear().domain(yDomain).range(yRange);
        } else {
            return d3.scaleLog().domain(yDomain).range(yRange);
        }
    }

    yRange() /*: array<number> */{
        const svgHeight = this.svgHeight();
        return [svgHeight, 0];
        //return [0, svgHeight];
    }

    yAxis() /*: function */{
        const { showPercentageValue } = this.props,
              yScale = this.yScale();

        return !showPercentageValue ? d3.axisLeft(yScale).ticks(3, ",.0s") : d3.axisLeft(yScale).ticks(3).tickFormat(t => t + "%");
    }

    render() {
        const data = this.data(),
              { title, divWidth, svgMargin, showPercentageValue } = this.props,
              divHeight = this.divHeight(),
              svgHeight = this.svgHeight(),
              x0Scale = this.x0Scale(),
              x1Scale = this.x1Scale(),
              yScale = this.yScale();
        //y1Scale = this.y1Scale();

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
                                        y: "0",
                                        width: x1Scale.bandwidth(),
                                        height: yScale(showPercentageValue ? d.percentageValue : d.value),
                                        style: { fill: this.barColor(d) },
                                        onClick: e => this.onBarClicked(Object.assign({ category: d.category }, e)) },
                                    React.createElement(
                                        "title",
                                        null,
                                        d.value + "\n%" + d.percentageValue
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
        xAxisNode.selectAll(".tick").on("click", category => this.onBarClicked(Object.assign({ category: category }, d3.event)));

        //adjust the y axis label colors (Caution: avoid nested selections in d3, as it expects the data to be nested as well)
        xAxisNode.selectAll(".tick text").data(this.categories()).style("fill", category => this.categoryTitleColor(category)).html(category => this.categoryTitle(category));
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
} //end of GroupedBarChartVertical component def

GroupedBarChartVertical.propTypes = propTypes;
GroupedBarChartVertical.defaultProps = defaultProps;

GroupedBarChartVertical.barHeightScale = d3.scaleLinear().domain([1, 11]).range(["2.5ch", "0.5ch"]).clamp(true);

module.exports = GroupedBarChartVertical;
