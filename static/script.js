window.chartColors = {
  red: 'rgb(255, 99, 132)',
  orange: 'rgb(255, 159, 64)',
  yellow: 'rgb(255, 205, 86)',
  green: 'rgb(75, 192, 192)',
  blue: 'rgb(54, 162, 235)',
  purple: 'rgb(153, 102, 255)',
  grey: 'rgb(201, 203, 207)'
};
const app = new Vue({
  el: '#app',
  components: {
    'bar-chart': VueChartJs.Bar,
    'pie-chart': VueChartJs.Pie,
    'line-chart': VueChartJs.Line,
  },
  data: {
    PRESETS: {
      type: {
        'github-repo': window.chartColors.red,
        'plain-source-upload': window.chartColors.green,
        'source-upload': window.chartColors.yellow,
      },
      status: {
        'preparing': window.chartColors.grey,
        'waiting': window.chartColors.yellow,
        'building': window.chartColors.blue,
        'done': window.chartColors.green,
        'failed': window.chartColors.red,
      }
    },
    rawData: {
      counter: {},
      currentAvailable: false,
      isUsingCache: true,
    },
    monthChartType: 'type', // 'type' / 'status'
    monthChartTypeSwitch: false,
  },
  computed: {
    monthChartData () {
      const counterDates = Object.keys(this.rawData.counter).reverse();
      return {
        labels: counterDates,
        datasets:
          Object.keys(this.PRESETS[this.monthChartType])
                .map(field => ({
                  label: field,
                  backgroundColor: this.PRESETS[this.monthChartType][field],
                  data: counterDates.map(date =>
                    this.rawData.counter[date]
                      .filter(build => build[this.monthChartType] === field)
                      .length),
                })),
      };
    },
    pieChartData () {
      const data = Object.keys(this.PRESETS[this.monthChartType]).map(field => {
        let total = 0;
        Object.keys(this.rawData.counter)
              .forEach(date => {
                total += this.rawData.counter[date]
                          .filter(build => field === build[this.monthChartType])
                          .length;
              });
        return total;
      });
      return {
        labels: Object.keys(this.PRESETS[this.monthChartType]),
        datasets: [{
          data,
          backgroundColor:
            Object.keys(this.PRESETS[this.monthChartType])
                  .map(field => this.PRESETS[this.monthChartType][field]),
        }],
      };
    },
    timeBuildChartData () {
      const labels = [];
      const timeUsed = [];
      const timeWait = [];
      Object.keys(this.rawData.counter).reverse()
            .forEach(date => {
              this.rawData.counter[date].forEach(build => {
                labels.push(build.status);
                if (build.timeStart !== -1 && build.timeEnd !== -1 && build.status === 'done') {
                  timeUsed.push((build.timeEnd - build.timeStart) / 1000);
                } else {
                  timeUsed.push(0);
                }
                if (build.timeSubmit !== -1 && build.timeStart !== -1) {
                  timeWait.push((build.timeStart - build.timeSubmit) / 1000);
                } else {
                  timeWait.push(0);
                }
              });
            });
      return {
        labels,
        datasets: [{
          label: 'Time used (if not failed)',
          data: timeUsed,
          borderColor: window.chartColors.blue,
          backgroundColor: window.chartColors.blue,
          fill: false,
        },{
          label: 'Time wait',
          data: timeWait,
          borderColor: window.chartColors.yellow,
          backgroundColor: window.chartColors.yellow,
          fill: false,
        }]
      }
    },
    maxTimeBuild () {
      return Math.max(...this.timeBuildChartData.datasets[0].data);
    },
    minTimeBuild () {
      return Math.min(...this.timeBuildChartData.datasets[0].data.filter(val => val !== 0));
    },
    averageTimeBuild () {
      const data = this.timeBuildChartData.datasets[0].data.filter(val => val !== 0);
      const sum = data.reduce((a, b) => a + b, 0);
      return data.length ? sum / data.length : 0;
    },
    maxTimeWait () {
      return Math.max(...this.timeBuildChartData.datasets[1].data);
    },
  },
  mounted () {
    this.fetchData();
    this.renderMonthChart();
    this.renderPieChart();
    this.renderTimeBuildChart();
  },
  watch: {
    monthChartTypeSwitch (val) {
      if (val === true) {
        this.monthChartType = 'status';
      } else {
        this.monthChartType = 'type';
      }
    },
    monthChartData () {
      this.renderMonthChart();
    },
    pieChartData () {
      this.renderPieChart();
    },
    timeBuildChartData () {
      this.renderTimeBuildChart();
    }
  },
  methods: {
    fetchData () {
      axios.get('/check-server-status')
      .then(response => {
        this.rawData = response.data;
      });
    },
    renderMonthChart () {
      this.$refs.monthChart.renderChart(this.monthChartData, {
        title: {
          display: true,
          text: 'Monthly trend'
        },
        tooltips: { mode: 'index', intersect: false },
        scales: { xAxes: [{ stacked: true }], yAxes: [{ stacked: true }] },
      });
    },
    renderPieChart () {
      this.$refs.pieChart.renderChart(this.pieChartData, {
        title: {
          display: true,
          text: 'build types'
        }
      });
    },
    renderTimeBuildChart () {
      this.$refs.timeBuildChart.renderChart(this.timeBuildChartData, {
        title: {
          display: true,
          text: 'Time of builds'
        }
      });
    }
  }
});