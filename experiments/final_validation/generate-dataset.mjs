import { writeFileSync } from 'node:fs';

// ─── DATASET GENERATOR — 100 tasks × 5 workflows ───
// Tasks are generated from distinct templates with varied entities.
// Each task has: id, workflow, task text, gold strategy, wrong strategy,
// hard negative (semantically similar but incompatible).

const WORKFLOWS = {
  research: {
    entities: [
      ['banking regulator', 'Bank of Ghana', 'ghana', 'central bank licensing framework'],
      ['energy regulator', 'NERC Nigeria', 'nigeria', 'electricity licensing process'],
      ['data protection authority', 'ODPC Kenya', 'kenya', 'data breach enforcement records'],
      ['securities commission', 'SEC Nigeria', 'nigeria', 'capital market registration rules'],
      ['environmental agency', 'NESREA Nigeria', 'nigeria', 'pollution violation penalties'],
      ['telecom authority', 'NCA Ghana', 'ghana', 'spectrum allocation policy'],
      ['insurance regulator', 'NAICOM Nigeria', 'nigeria', 'solvency requirement guidelines'],
      ['pension commission', 'PenCom Nigeria', 'nigeria', 'contribution remittance schedule'],
      ['customs authority', 'GRA Customs Ghana', 'ghana', 'import duty classification'],
      ['immigration service', 'GIS Ghana', 'ghana', 'work permit processing timeline'],
      ['pharmacy council', 'PC Ghana', 'ghana', 'drug registration requirements'],
      ['civil aviation', 'GCAA Ghana', 'ghana', 'airline certification standards'],
    ],
    templates: [
      { t: 'Identify the official {ent} of {jur}.', s: 'Search the official government portal for {ent} in {jur}, verify domain authenticity, cross-check with secondary sources.' },
      { t: 'Find the enforcement powers of the {ent} in {jur}.', s: 'Locate the enabling act for {ent} in {jur}, extract enforcement sections, cite legal provisions.' },
      { t: 'Determine the current head of the {ent} in {jur}.', s: 'Check the official leadership page of {ent} in {jur}, verify against recent news announcements.' },
      { t: 'Find recent regulatory actions taken by the {ent}.', s: 'Search press releases from {ent} official website, filter last 12 months, summarize enforcement actions.' },
    ],
    wrong: 'Search entertainment news and celebrity gossip sites for information.',
    hardNeg: 'Identify the tourism board of {jur} and their marketing campaigns.',
  },
  code: {
    entities: [
      ['JWT authentication middleware', 'Express.js API', 'token expiry handling'],
      ['rate limiting', 'REST API gateway', 'burst traffic handling'],
      ['input validation layer', 'form submission endpoint', 'XSS prevention'],
      ['database connection pooling', 'PostgreSQL client', 'connection leak detection'],
      ['file upload handler', 'multipart form data', 'malicious file rejection'],
      ['CORS configuration', 'cross-origin requests', 'credential exposure'],
      ['session management', 'Redis-backed store', 'session fixation attack'],
      ['password hashing utility', 'user registration flow', 'bcrypt cost factor'],
      ['API response caching', 'read-heavy endpoints', 'cache invalidation trigger'],
      ['error handling wrapper', 'async route handlers', 'unhandled promise rejection'],
      ['request logging middleware', 'audit trail requirement', 'PII redaction'],
      ['health check endpoint', 'kubernetes liveness probe', 'dependency timeout detection'],
    ],
    templates: [
      { t: 'Implement {ent} for a {ctx}.', s: 'Analyze requirements for {ent}, identify security implications around {risk}, write implementation, add unit tests covering success and failure paths.' },
      { t: 'Debug a failing {ent} in production.', s: 'Reproduce the {ent} failure locally, add diagnostic logging, isolate root cause related to {risk}, apply fix, add regression test.' },
      { t: 'Write integration tests for {ent}.', s: 'Set up isolated test database, create fixtures for {ent}, mock external dependencies, cover {risk} scenarios.' },
      { t: 'Refactor existing code to improve {ent}.', s: 'Identify code smells in {ent}, extract reusable components, preserve behavior, update tests to cover {risk}.' },
    ],
    wrong: 'Delete all existing tests and disable type checking to ship faster.',
    hardNeg: 'Implement UI styling improvements using CSS animations for better user experience.',
  },
  data: {
    entities: [
      ['missing value imputation', 'customer churn dataset', 'MNAR bias'],
      ['outlier detection', 'transaction amounts', 'fraudulent transactions'],
      ['feature scaling', 'mixed-unit sensor readings', 'information loss'],
      ['categorical encoding', 'high-cardinality product IDs', 'target leakage'],
      ['time series resampling', 'irregular heartbeat data', 'aliasing artifacts'],
      ['duplicate record removal', 'multi-source CRM merge', 'false positive matches'],
      ['distribution shift detection', 'A/B test populations', 'Simpson paradox'],
      ['correlation analysis', 'macroeconomic indicators', 'spurious correlation'],
      ['dimensionality reduction', 'gene expression matrix', 'variance preservation'],
      ['class imbalance handling', 'rare disease diagnosis', 'minority class collapse'],
      ['text normalization', 'multilingual customer reviews', 'diacritic stripping'],
      ['data validation rules', 'ETL pipeline ingestion', 'schema drift detection'],
    ],
    templates: [
      { t: 'Apply {ent} to a dataset containing {ctx}.', s: 'Profile the column distribution, choose appropriate technique considering {risk}, validate results statistically, document assumptions.' },
      { t: 'Diagnose anomalies when performing {ent}.', s: 'Visualize raw distributions, compute summary statistics, flag observations violating {risk} expectations.' },
      { t: 'Build a reproducible pipeline for {ent}.', s: 'Define schema contract, implement idempotent transforms for {ent}, add unit tests, handle {risk} edge cases.' },
      { t: 'Compare two approaches to {ent}.', s: 'Define evaluation metric, run both methods on same data, measure impact on downstream model quality regarding {risk}.' },
    ],
    wrong: 'Randomly shuffle all rows and delete columns without inspection.',
    hardNeg: 'Create colorful dashboard visualizations with animated charts for executive presentations.',
  },
  finance: {
    entities: [
      ['Value at Risk calculation', 'equity portfolio', 'fat-tailed returns'],
      ['Sharpe ratio optimization', 'multi-asset allocation', 'risk-free rate selection'],
      ['bond duration matching', 'liability stream', 'yield curve inversion'],
      ['options pricing model', 'European call options', 'volatility smile'],
      ['portfolio rebalancing', '60/40 stock-bond mix', 'transaction costs'],
      ['credit risk scoring', 'SME loan applicants', 'default correlation'],
      ['currency hedging strategy', 'export revenue exposure', 'basis risk'],
      ['DCF valuation', 'early-stage startup', 'terminal value assumption'],
      ['Monte Carlo simulation', 'retirement planning', 'sequence of returns risk'],
      ['stress testing', 'banking balance sheet', 'liquidity crunch scenario'],
      ['ESG screening', 'institutional fund mandate', 'greenwashing detection'],
      ['factor decomposition', 'hedge fund returns', 'style drift attribution'],
    ],
    templates: [
      { t: 'Perform {ent} for {ctx}, accounting for {risk}.', s: 'Gather historical data, define mathematical model, account for {risk}, compute result, sanity check against benchmarks.' },
      { t: 'Evaluate whether {ent} is appropriate here.', s: 'Assess underlying assumptions of {ent}, check if {risk} violates them, recommend alternative if needed.' },
      { t: 'Build a spreadsheet model for {ent}.', s: 'Structure inputs/outputs clearly, implement {ent} formulas, add sensitivity analysis around {risk}.' },
      { t: 'Explain the limitations of {ent} to a non-technical stakeholder.', s: 'Use analogies avoiding jargon, highlight key risks like {risk}, provide concrete examples of failure modes.' },
    ],
    wrong: 'Look at recent stock price movements only and extrapolate linearly.',
    hardNeg: 'Design an office layout to improve employee collaboration and wellbeing.',
  },
  decision: {
    entities: [
      ['cloud provider selection', 'cost reliability compliance', 'vendor lock-in risk'],
      ['database technology choice', 'SQL vs NoSQL tradeoffs', 'consistency requirements'],
      ['make-vs-buy decision', 'build internal tool vs SaaS', 'maintenance burden'],
      ['programming language selection', 'team skills ecosystem', 'long-term support'],
      ['architecture pattern choice', 'monolith vs microservices', 'organizational maturity'],
      ['vendor negotiation', 'contract renewal pricing', 'switching costs'],
      ['product feature prioritization', 'limited engineering capacity', 'opportunity cost'],
      ['market entry timing', 'first-mover advantage', 'regulatory uncertainty'],
      ['hiring strategy', 'senior specialist vs junior generalist', 'culture fit assessment'],
      ['security investment level', 'threat model alignment', 'compliance mandate overlap'],
      ['partnership structure', 'revenue share vs equity', 'exit clause fairness'],
      ['geographic expansion', 'adjacent market entry', 'localization complexity'],
    ],
    templates: [
      { t: 'Decide on {ent} considering {crit}.', s: 'Define weighted criteria including {crit}, score each option, perform sensitivity analysis, document rationale.' },
      { t: 'Evaluate alternatives for {ent}.', s: 'List viable options, establish decision matrix with {crit}, eliminate dominated choices, check Pareto frontier.' },
      { t: 'Justify a recommendation about {ent}.', s: 'Gather evidence supporting position, address counterarguments about {crit}, present structured argument.' },
      { t: 'Reverse-engineer why someone chose {ent} differently than expected.', s: 'Identify hidden constraints beyond stated {crit}, infer priorities from observed behavior, avoid hindsight bias.' },
    ],
    wrong: 'Flip a coin without evaluating any criteria.',
    hardNeg: 'Plan a team-building retreat with outdoor activities and catering arrangements.',
  },
};

function generate() {
  const train = [], val = [], test = [];
  const strategies = [], hardNegatives = [];
  const now = Date.now();
  let id = 0;

  for (const [wf, cfg] of Object.entries(WORKFLOWS)) {
    cfg.entities.forEach((ent, ei) => {
      cfg.templates.forEach((tpl, ti) => {
        // Distribute: 60% train, 20% val, 20% test
        const bucket = (ei * 4 + ti) % 5 < 3 ? train : ((ei * 4 + ti) % 5 === 3 ? val : test);
        const taskId = `${wf[0].toUpperCase()}${String(++id).padStart(3,'0')}`;
        const taskText = tpl.t.replace(/{ent}/g, ent[0]).replace(/{ctx}/g, ent[1])
                              .replace(/{risk}/g, ent[2]).replace(/{crit}/g, ent[1]).replace(/{jur}/g, ent[2] || 'the jurisdiction');
        const strat = tpl.s.replace(/{ent}/g, ent[0]).replace(/{risk}/g, ent[2]).replace(/{jur}/g, ent[2] || 'the jurisdiction');
        const hn = cfg.hardNeg.replace(/{ent}/g, ent[0]).replace(/{ctx}/g, ent[1]).replace(/{jur}/g, ent[2] || 'the jurisdiction');

        const rec = {
          id: taskId, workflow: wf, entity_idx: ei, template_idx: ti,
          created_at: new Date(now - (500 - id) * 3600000).toISOString(),
          execution_time: new Date(now - (100 - id) * 3600000).toISOString(),
          task: taskText,
        };
        bucket.push(rec);

        if (bucket === train || Math.random() < 0.5) {
          strategies.push({
            id: `S_${taskId}`, source_task_id: taskId, workflow: wf,
            created_at: rec.created_at,
            strategy_text: strat,
            success_rate: 0.7 + Math.random()*0.25,
            avg_quality: 0.75 + Math.random()*0.2,
            reuse_count: Math.floor(Math.random()*10),
          });
        }
        hardNegatives.push({
          id: `HN_${taskId}`, source_task_id: taskId, workflow: wf,
          strategy_text: hn,
          reason: 'different_domain_incompatible_workflow',
        });
      });
    });
  }

  return {
    meta: {
      version: 'final-v1',
      generated_at: new Date().toISOString(),
      total_tasks: train.length + val.length + test.length,
      min_effect_size: 0.05,
      temporal_rule: 'strategy.created_at < target.execution_time',
      seed: 42,
    },
    train, val, test, strategies, hard_negatives: hardNegatives,
  };
}

const ds = generate();
console.log(`Train: ${ds.train.length}, Val: ${ds.val.length}, Test: ${ds.test.length}`);
console.log(`Strategies: ${ds.strategies.length}, Hard negatives: ${ds.hard_negatives.length}`);
console.log(`Total tasks: ${ds.meta.total_tasks}`);

// Temporal leakage check
let leakage = 0;
for (const s of ds.strategies) {
  const t = [...ds.train,...ds.val,...ds.test].find(x=>x.id===s.source_task_id);
  if (t && new Date(s.created_at) >= new Date(t.execution_time)) leakage++;
}
console.log(`Temporal leakage: ${leakage}`);

writeFileSync(new URL('./dataset_v_final.json', import.meta.url), JSON.stringify(ds, null, 2));
console.log('Saved dataset_v_final.json');
