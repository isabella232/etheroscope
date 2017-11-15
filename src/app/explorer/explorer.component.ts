import { Component } from "@angular/core";
import { ContractService } from "../_services/contract.service";

import { fadeInAnimation } from "../_animations/index";
import { SlicePipe } from '@angular/common';
import {Clipboard} from 'ts-clipboard';


enum FilterGroup {
  dates,
  values
};

@Component({
  styleUrls: ['./explorer.component.scss'],
  templateUrl: './explorer.component.html',
  animations: [fadeInAnimation],
  host: {'[@fadeInAnimation]': ''}
})

export class ExplorerComponent {
  single: any[];
  multi: any[];

  contractHash: any[] = [{"name": "Alice.si", "hash": "0xBd897c8885b40d014Fb7941B3043B21adcC9ca1C"}]
  curContractID: string;
  curContractName: string;
  methods: string[];
  displayMethods: boolean;
  displayGraph: boolean;
  displayBadExploreRequestWarning: boolean;
  graphDatapoints: number[][];
  methodDatapoints: number[][];
  lastMethod: string;
  lastContract: string;
  placeholder: string;
  datapointFilters: {message: string, filter: ((datapoint: any[]) => boolean)}[];
  matches: any;

  methodHasInitialResponse: boolean;
  waitingForInitialPoints: boolean;
  cachedFrom: number;
  cachedTo: number;
  latestBlock: number;
  progressBar: number;

  selectedCompany: any;

  timesValues: any[];

  view: any[];

  userSearching: boolean;

  // Graph options
  showXAxis = true;
  showYAxis = true;
  gradient = false;
  showLegend = false;
  showXAxisLabel = true;
  xAxisLabel = 'Date';
  showYAxisLabel = true;
  yAxisLabel = 'Value';
  timeline = true;

  colorScheme = {
    domain: ['#1998a2', '#A10A28', '#C7B42C', '#AAAAAA']
  };

  // line, area
  autoScale = true;

  constructor(private contractService: ContractService) {
    this.userSearching = true;
    this.initialiseVariables();
    this.contractService.latestBlockEvent().subscribe(
      (latestBlock: any) => {
        this.latestBlock = latestBlock.latestBlock;
      }
    );
    this.contractService.getHistoryEvent().subscribe(
      (datapoints: any) => {
        console.log(datapoints)
        if (datapoints.error) { return; }
        if (!this.methodHasInitialResponse) {
            this.methodHasInitialResponse = true;
            this.cachedFrom = parseInt(datapoints.from);
            this.cachedTo = parseInt(datapoints.to);
        } else {
            this.cachedFrom = Math.min(this.cachedFrom, parseInt(datapoints.from));
            this.cachedTo = Math.max(this.cachedTo, parseInt(datapoints.to));
            console.log(this.progressBar);
        }
        this.progressBar = Math.ceil(100 * (this.cachedTo - this.cachedFrom) / this.latestBlock);
        if (datapoints.results.length !== 0) {
          this.waitingForInitialPoints = false;
          this.methodDatapoints = this.methodDatapoints.concat(datapoints.results);
          this.removeDuplicateDatapoints();
          this.filterGraphDatapoints();
          console.log("Updating graph");
          this.updateGraph();
        }
      },
      (error) => {
        console.log(error);
      },
      () => {
        console.log("completed data point generation");
        this.updateGraph();
      }
    );
  }

  private initialiseVariables() {
      this.progressBar = 0;
      this.curContractID = '';
      this.curContractName = '';
      this.placeholder = null;
      this.single = [];
      this.multi = [];
      this.displayMethods = false;
      this.displayGraph = false;
      this.methods = [];
      this.timesValues = [];
      this.lastMethod = null;
      this.lastContract = null;
      this.methodHasInitialResponse = false;
      this.graphDatapoints = [];
      this.methodDatapoints = [];
      this.datapointFilters = [];
      this.waitingForInitialPoints = false;
  }

  onSelect(event) {
    console.log(event);
  }

  newFilterFromForm(formInput: any) {
    if (formInput.startDate !== "" && formInput.endDate !== "") {
      let startDateNo = Math.round(new Date(formInput.startDate).getTime() / 1000);
      let endDateNo = Math.round(new Date(formInput.endDate).getTime() / 1000);
      this.addFilterOnDatesBetween(startDateNo, endDateNo);
    }
  }

  filterOnLast(length: number, timeframe: string) {
    let curDate = new Date();
    let toDate  = new Date();
    // make sure both dates seconds are alligned
    toDate.setSeconds(curDate.getSeconds());
    switch (timeframe) {
      case 'hour':
        toDate.setHours(curDate.getHours() - length);
        break;
      case 'day':
        toDate.setDate(curDate.getDate() - length);
        break;
      case 'week':
        toDate.setDate(curDate.getDate() - (length * 7));
        break;
      case 'month':
        toDate.setMonth(curDate.getMonth() - length);
        break;
      case 'year':
        toDate.setFullYear(curDate.getFullYear() - length);
        break;
      default:
        // other timeframes not supported
        return;
    }
    let now  = Math.round(curDate.getTime() / 1000);
    let to = Math.round(toDate.getTime() / 1000);
    this.addFilterOnDatesBetween(to, now);
  }

  deleteFilter(index: number) {
    this.datapointFilters.splice(index, 1);
    this.filterGraphDatapoints();
    this.updateGraph();
  }

  removeDuplicateDatapoints() {
    // get rid of datapoints with duplicate times
    let seenTime = {};
    this.methodDatapoints = this.methodDatapoints.filter( (point) => {
      if (seenTime.hasOwnProperty(point[0])) {
        return false;
      }
      seenTime[point[0]] = true;
      return true;
    });
  }

  filterGraphDatapoints() {
    this.graphDatapoints = this.methodDatapoints.filter( (point) => {
      let len = this.datapointFilters.length;
      for (let i = 0; i < len; i++) {
        if (!this.datapointFilters[i].filter(point)) {
          return false;
        }
      }
      return true;
    })
  }

  addFilterOnDatesBetween(startDate: number, endDate: number) {
    let startDisplayDate = new Date(0);
    let endDisplayDate = new Date(0);
    startDisplayDate.setUTCSeconds(+startDate);
    endDisplayDate.setUTCSeconds(+endDate);
    let message = "Dates between " + startDisplayDate.toLocaleString()
      + " - " + endDisplayDate.toLocaleString();
    this.datapointFilters[FilterGroup.dates] = {
      message: message,
      filter: (point) => {
        return point[0] >= startDate && point[0] <= endDate;
      }
    };
    this.filterGraphDatapoints();
    this.updateGraph();
  }

  exploreContract(contract: string) {
    console.log('exploring')
    this.userSearching = false;
    this.curContractID = contract;
    this.displayGraph = false;
    this.contractService.exploreContract(contract).subscribe(
      (contractInfo) => {
        console.log('Contract INFO');
        console.log(contractInfo);
        this.methods = contractInfo.variableNames;
        if (contractInfo.contractName === null) {
          this.curContractName = 'unknown';
        } else {
          this.curContractName = contractInfo.contractName;
        }
      },
      (error) => {
        if (error.status === 400) {
              this.displayBadExploreRequestWarning = true;
        }
      },
      () => {
        this.placeholder = contract;
        console.log("completed contract exploring");
        this.displayBadExploreRequestWarning = false;
        this.displayMethods = true;
      }
    );
  }

  updateGraph() {
    this.timesValues = [];
    if (this.graphDatapoints !== null && this.graphDatapoints !== undefined
      && this.graphDatapoints.length > 0) {
      this.graphDatapoints.sort((a, b) => {
        return a[0] - b[0];
      })
      this.timesValues = [];
      this.graphDatapoints.forEach((elem) => {
        let date = new Date(0);
        date.setUTCSeconds(+elem[0]);
        this.timesValues.push({"name": date, "value": +elem[1]});
      })
      this.displayGraph = true;
      this.multi = [...[{ "name": "", "series": this.timesValues}]];
    }
  }

  generateDatapoints(method: string) {
    if (method !== this.lastMethod || this.curContractID !== this.lastContract ||
      this.lastContract === null || this.lastMethod === null) {
      this.contractService.leaveMethod(this.lastContract, this.lastMethod);
      this.progressBar = 0;
      this.waitingForInitialPoints = true;
      this.methodHasInitialResponse = false;
      this.lastContract = this.curContractID;
      this.lastMethod = method;
      // flush the current method datapoints
      this.methodDatapoints = [];
      this.contractService.generateDatapoints(this.curContractID, method);
    }
  }

  exploreCompany() {
    this.exploreContract(this.selectedCompany.hash);
  }

  selectCompany(hash: string) {
    this.exploreContract(hash);
  }

  searchContracts(pattern: string) {
    this.contractService.searchContracts(pattern).subscribe(
      (matches) => {
        this.matches = matches;
      },
      (error) => {
        this.matches = null;
        console.log(error);
      },
      () => {
      })
  }

  copyToClipboard(clip: string) {
    Clipboard.copy(clip);
  }
}
