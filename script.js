document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const imdList = ["PL52LD","PL51EE","PL51TH","PL51BT","PL51QZ"]; // truncated
  const triage = {
    postcodeMatch(pc) { return imdList.includes(pc.replace(/\s+/g,'').toUpperCase()); },
    anyChecked(cls) { return [...document.querySelectorAll('.'+cls+':checked')].map(e => e.value); },
    show(el) { el.classList.remove('hidden'); },
    hide(el) { el.classList.add('hidden'); },
    showAdvanced() { this.show($("advancedFin")); },
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
      const gross = parseFloat($("gross").value || 0);
      const grossOk = gross > 0 && gross <= 36000;
      let pathway = "", finElig = false;
      if (postcodeOk) { pathway = "1 IMD"; finElig = true; }
      else if (benefitOk) { pathway = "2 benefits"; finElig = true; }
      else if (grossOk) { pathway = "3 gross"; finElig = true; }
      else {
        this.showAdvanced();
        const net = parseFloat($("net").value || 0);
        const housing = parseFloat($("housing").value || 0);
        const adults = parseInt($("adults").value);
        const children = parseInt($("children").value);
        const scale = 1 + 0.5 * (adults - 1) + 0.3 * children;
        const ahc = (net - housing) / scale;
        if (ahc > 0 && ahc < 14625) {
          pathway = "4 AHC"; finElig = true;
        } else {
          const proxies = this.anyChecked("proxy");
          if (proxies.length >= 2 && !((proxies.includes('5') || proxies.includes('6')) && proxies.includes('7'))) {
            pathway = "5 ECO‑Flex"; finElig = true;
          }
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
      if (outcome === "Year 1 Priority 1" || outcome === "Year 1 Priority 2") {
        this.show($("docsSection"));
        this.show($("measuresSection"));
      } else {
        this.hide($("docsSection"));
        this.hide($("measuresSection"));
      }
      $("result").value = `Outcome: ${outcome}\nFinancial pathway: ${pathway}\nTenure: ${$("tenure").value}\nDocs by: ${$("docsBy").value || 'N/A'}`;
      const dump = {
        consent: [$("consentGen").checked, $("consentHealth").checked, $("consentShare").checked],
        call: $("callTime").value,
        attempt: $("attempt").value,
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
        const ok = this.postcodeMatch($("postcode").value);
        $("imdFlag").innerHTML = 'IMD eligibility: <strong>' + (ok ? 'Yes' : 'No') + '</strong>';
      });
      $("upgraded").addEventListener('change', () => this.checkBorderline());
      $("sap").addEventListener('input', () => this.checkBorderline());
      $("calcBtn").addEventListener('click', () => this.calculate());
    }
  };
  triage.bindEvents();
});

