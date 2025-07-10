document.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);
  const imdSet = new Set();
  const deciles = new Map();
  const imdProxy = document.querySelector('.proxy[value="1"]');

  async function loadData() {
    const [imdText, decText] = await Promise.all([
      fetch('data/DESNZ - eligible post codes - IMD 1-2 postcodes.csv').then(r => r.text()),
      fetch('data/2019-deprivation-by-postcode_PLYMOUTH.csv').then(r => r.text())
    ]);
    imdText.split(/\r?\n/).slice(1).forEach(line => {
      const pc = line.trim();
      if (pc) imdSet.add(pc.replace(/\s+/g, '').toUpperCase());
    });
    decText.split(/\r?\n/).slice(1).forEach(line => {
      if (!line.trim()) return;
      const [pc, imdDecile, incomeDecile] = line.split(',');
      if (pc) deciles.set(pc.replace(/\s+/g, '').toUpperCase(),
        { imdDecile, incomeDecile });
    });
  }

  await loadData();
  const triage = {
    postcodeMatch(pc) { return imdSet.has(pc.replace(/\s+/g,'').toUpperCase()); },
    getDeciles(pc) {
      return deciles.get(pc.replace(/\s+/g,'').toUpperCase()) || null;
    },
    anyChecked(cls) { return [...document.querySelectorAll('.'+cls+':checked')].map(e => e.value); },
    show(el) { el.classList.remove('hidden'); },
    hide(el) { el.classList.add('hidden'); },
    showAdvanced() {
      document.querySelectorAll('.advFin').forEach(el => this.show(el));
    },
    // Determine eligibility for ECO Flex Route 2.
    // A household must select at least two proxies and one of the
    // selected pairs must appear in the approved list below.
    flexEligible(proxies) {
      if (proxies.length < 2) return false;
      const validPairs = new Set([
        '1-2','1-4','1-5','1-6','1-7',
        '2-3','2-4','2-5','2-6','2-7',
        '3-4','3-5','3-6','3-7',
        '4-5','4-6','4-7',
        '5-6'
      ]);
      const unique = [...new Set(proxies)];
      for (let i = 0; i < unique.length; i++) {
        for (let j = i + 1; j < unique.length; j++) {
          const pair = `${unique[i]}-${unique[j]}`;
          const rev = `${unique[j]}-${unique[i]}`;
          if (validPairs.has(pair) || validPairs.has(rev)) return true;
        }
      }
      return false;
    },
    checkBorderline() {
      const sap = parseInt($("sap").value || 0);
      if (sap >= 60 && sap <= 68 && $("upgraded").checked) {
        this.show($("deReviewWrap"));
      } else {
        this.hide($("deReviewWrap"));
      }
    },
    calculate() {
      const postcodeOk = this.postcodeMatch($("postcode").value);
      const benefitOk = this.anyChecked("benefit").length > 0;
      const proxies = this.anyChecked("proxy");
      const gross = parseFloat($("gross").value || 0);
      const grossOk = gross > 0 && gross <= 36000;
      const possible = [];
      if (postcodeOk) possible.push("Pathway 1 – IMD 1-2 postcode");
      if (benefitOk) possible.push("Pathway 2 – Means-tested benefits");
      const flexOk = this.flexEligible(proxies);
      if (flexOk) possible.push("Pathway 2 – ECO Flex Route 2");
      if (grossOk) possible.push("Pathway 3 – Income < £36,000");
      const net = parseFloat($("net").value || 0);
      const housing = parseFloat($("housing").value || 0);
      const adults = parseInt($("adults").value || 0);
      const children = parseInt($("children").value || 0);
      const ahc = net - housing;
      const dependents = children;
      let ahcMax = 0;

      if (adults === 1) {
        if (dependents === 3) ahcMax = 23600;
        else if (dependents === 4) ahcMax = 27600;
        else if (dependents >= 5) ahcMax = 31600;
        else ahcMax = 20000;
      } else if (adults >= 2) {
        if (dependents === 1) ahcMax = 24000;
        else if (dependents === 2) ahcMax = 28000;
        else if (dependents === 3) ahcMax = 32000;
        else if (dependents === 4) ahcMax = 36000;
        else if (dependents >= 5) ahcMax = 40000;
        else ahcMax = 20000;
      }

      if (ahc > 20000 && ahcMax === 20000) {
        // Disqualify due to 20k ceiling for 0–2 dependents
      }
      const ahcOk = ahc > 0 && ahc <= ahcMax;
      if (ahcOk) possible.push("Pathway 3 – AHC Equalisation");
      let pathway = "", finElig = false;
      if (postcodeOk) {
        pathway = "1 IMD"; finElig = true;
      } else if (benefitOk) {
        pathway = "2 benefits"; finElig = true;
      } else {
        this.showAdvanced();
        if (flexOk) {
          pathway = "2 ECO Flex"; finElig = true;
        } else if (grossOk) {
          pathway = "3 income"; finElig = true;
        } else if (ahcOk) {
          pathway = "3 AHC"; finElig = true;
        }
      }
      let propElig = ["D","E","F","G"].includes($("epc").value) && parseInt($("sap").value || 0) < 70;
      if ($("deReview").value === "noNotEligible") propElig = false;
      if ($("deReview").value === "yes") propElig = false;
      const vulns = this.anyChecked("vuln").length;
      const cavity = $("cavity").checked;
      let outcome = "Not eligible";
      if (finElig && propElig) {
        if (cavity) {
          if (vulns >= 2) outcome = "Year 1 Priority 1";
          else if (vulns === 1) outcome = "Year 1 Priority 2";
          else outcome = "Year 1 Priority 3";
        } else {
          outcome = "Year 2";
        }
      }
      if ($("deReview").value === "yes") outcome = "Refer to DE";
      let reason = "";
      if (outcome === "Not eligible") {
        if (!finElig) {
          reason = "No eligible financial pathway";
        } else if (!propElig) {
          if ($("deReview").value === "noNotEligible") {
            reason = "DE review: property ineligible";
          } else {
            const epcVal = $("epc").value;
            const sapVal = parseInt($("sap").value || 0);
            if (!["D", "E", "F", "G"].includes(epcVal)) {
              reason = "EPC rating must be D to G";
            } else if (sapVal >= 70) {
              reason = "SAP score must be below 70";
            } else {
              reason = "Property not eligible";
            }
          }
        }
      }
      if (outcome === "Year 1 Priority 1" || outcome === "Year 1 Priority 2") {
        this.show($("docsSection"));
        this.show($("measuresSection"));
      } else {
        this.hide($("docsSection"));
        this.hide($("measuresSection"));
      }
      const reasonStr = reason ? `\nReason: ${reason}` : "";
      $("result").value = `Outcome: ${outcome}${reasonStr}\nFinancial pathway: ${pathway}\nPossible pathways: ${possible.join(', ')}\nTenure: ${$("tenure").value}\nDocs by: ${$("docsBy").value || 'N/A'}`;
      const dump = {
        projectName: $("projectName").value,
        consent: [$("consentGen").checked, $("consentHealth").checked, $("consentShare").checked],
        call: $("callTime").value,
        attempt: $("attempt").value,
        whyContact: $("whyContact").value,
        heardVia: $("heardVia").value,
        postcode: $("postcode").value,
        benefits: this.anyChecked("benefit"),
        gross: $("gross").value,
        net: $("net").value,
        housing: $("housing").value,
        proxies: this.anyChecked("proxy"),
        vulns: this.anyChecked("vuln"),
        docs: this.anyChecked("doc"),
        measures: this.anyChecked("measure")
      };
      $("dump").value = JSON.stringify(dump, null, 2);
    },
    bindEvents() {
      $("postcode").addEventListener('input', () => {
        const value = $("postcode").value;
        const ok = this.postcodeMatch(value);
        const dec = this.getDeciles(value);
        $("imdFlag").innerHTML =
          'IMD eligibility: <strong>' + (ok ? 'Yes' : 'No') + '</strong>' +
          (dec
            ? '<br>Overall IMD decile: ' + dec.imdDecile +
              '<br>Income IMD decile: ' + dec.incomeDecile
            : '');
        if (dec && parseInt(dec.imdDecile, 10) >= 1 && parseInt(dec.imdDecile, 10) <= 3) {
          imdProxy.checked = true;
        } else {
          imdProxy.checked = false;
        }
      });
      $("upgraded").addEventListener('change', () => this.checkBorderline());
      $("sap").addEventListener('input', () => this.checkBorderline());
      $("calcBtn").addEventListener('click', () => this.calculate());
    }
  };
  triage.bindEvents();
});

