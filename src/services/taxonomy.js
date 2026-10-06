"use strict";
// Career knowledge base: skill taxonomy, role requirement profiles,
// safety risk patterns, and interview question banks.
// Used by the local intelligence engine. Deterministic and explainable.

const SKILLS = {
  // data
  "sql": { label: "SQL", category: "Technical", demand: "High" },
  "excel": { label: "Excel", category: "Technical", demand: "High" },
  "power bi": { label: "Power BI", category: "Tools", demand: "High" },
  "tableau": { label: "Tableau", category: "Tools", demand: "High" },
  "python": { label: "Python", category: "Technical", demand: "High" },
  "r": { label: "R", category: "Technical", demand: "Medium" },
  "statistics": { label: "Statistics", category: "Technical", demand: "Medium" },
  "data visualization": { label: "Data Visualization", category: "Technical", demand: "High" },
  "data modeling": { label: "Data Modeling", category: "Technical", demand: "Medium" },
  "etl": { label: "ETL", category: "Technical", demand: "Medium" },
  "data cleaning": { label: "Data Cleaning", category: "Technical", demand: "High" },
  "machine learning": { label: "Machine Learning", category: "Technical", demand: "High" },
  "pandas": { label: "Pandas", category: "Technical", demand: "Medium" },
  "numpy": { label: "NumPy", category: "Technical", demand: "Medium" },
  "a/b testing": { label: "A/B Testing", category: "Technical", demand: "Medium" },
  // engineering
  "javascript": { label: "JavaScript", category: "Technical", demand: "High" },
  "typescript": { label: "TypeScript", category: "Technical", demand: "High" },
  "react": { label: "React", category: "Technical", demand: "High" },
  "node.js": { label: "Node.js", category: "Technical", demand: "High" },
  "html": { label: "HTML", category: "Technical", demand: "High" },
  "css": { label: "CSS", category: "Technical", demand: "High" },
  "git": { label: "Git", category: "Tools", demand: "High" },
  "github": { label: "GitHub", category: "Tools", demand: "High" },
  "rest api": { label: "REST APIs", category: "Technical", demand: "High" },
  "api": { label: "APIs", category: "Technical", demand: "High" },
  "docker": { label: "Docker", category: "Tools", demand: "High" },
  "kubernetes": { label: "Kubernetes", category: "Tools", demand: "Medium" },
  "aws": { label: "AWS", category: "Tools", demand: "High" },
  "azure": { label: "Azure", category: "Tools", demand: "Medium" },
  "gcp": { label: "Google Cloud", category: "Tools", demand: "Medium" },
  "ci/cd": { label: "CI/CD", category: "Technical", demand: "High" },
  "linux": { label: "Linux", category: "Technical", demand: "High" },
  "testing": { label: "Testing", category: "Technical", demand: "High" },
  "java": { label: "Java", category: "Technical", demand: "High" },
  "c#": { label: "C#", category: "Technical", demand: "Medium" },
  "go": { label: "Go", category: "Technical", demand: "Medium" },
  "system design": { label: "System Design", category: "Technical", demand: "Medium" },
  // ai evaluation
  "prompt engineering": { label: "Prompt Engineering", category: "Technical", demand: "High" },
  "data annotation": { label: "Data Annotation", category: "Technical", demand: "High" },
  "data labeling": { label: "Data Labeling", category: "Technical", demand: "High" },
  "rlhf": { label: "RLHF", category: "Technical", demand: "Medium" },
  "llm evaluation": { label: "LLM Evaluation", category: "Technical", demand: "High" },
  "red teaming": { label: "Red Teaming", category: "Technical", demand: "Medium" },
  "written english": { label: "Written English", category: "Communication", demand: "High" },
  "attention to detail": { label: "Attention to Detail", category: "Soft", demand: "High" },
  "critical thinking": { label: "Critical Thinking", category: "Soft", demand: "High" },
  // product
  "product management": { label: "Product Management", category: "Technical", demand: "High" },
  "roadmapping": { label: "Roadmapping", category: "Technical", demand: "Medium" },
  "user research": { label: "User Research", category: "Technical", demand: "High" },
  "agile": { label: "Agile", category: "Methods", demand: "High" },
  "scrum": { label: "Scrum", category: "Methods", demand: "High" },
  "jira": { label: "Jira", category: "Tools", demand: "High" },
  "stakeholder management": { label: "Stakeholder Management", category: "Soft", demand: "High" },
  "prioritization": { label: "Prioritization", category: "Technical", demand: "High" },
  "analytics": { label: "Analytics", category: "Technical", demand: "High" },
  // security
  "cybersecurity": { label: "Cybersecurity", category: "Technical", demand: "High" },
  "network security": { label: "Network Security", category: "Technical", demand: "High" },
  "siem": { label: "SIEM", category: "Tools", demand: "High" },
  "incident response": { label: "Incident Response", category: "Technical", demand: "High" },
  "vulnerability assessment": { label: "Vulnerability Assessment", category: "Technical", demand: "High" },
  "penetration testing": { label: "Penetration Testing", category: "Technical", demand: "Medium" },
  "security+": { label: "Security+", category: "Certification", demand: "High" },
  "cissp": { label: "CISSP", category: "Certification", demand: "Medium" },
  "ceh": { label: "CEH", category: "Certification", demand: "Medium" },
  "firewalls": { label: "Firewalls", category: "Technical", demand: "High" },
  // design
  "figma": { label: "Figma", category: "Tools", demand: "High" },
  "ui design": { label: "UI Design", category: "Technical", demand: "High" },
  "ux design": { label: "UX Design", category: "Technical", demand: "High" },
  "wireframing": { label: "Wireframing", category: "Technical", demand: "High" },
  "prototyping": { label: "Prototyping", category: "Technical", demand: "High" },
  // business
  "project management": { label: "Project Management", category: "Methods", demand: "High" },
  "pmp": { label: "PMP", category: "Certification", demand: "Medium" },
  "communication": { label: "Communication", category: "Soft", demand: "High" },
  "teamwork": { label: "Teamwork", category: "Soft", demand: "High" },
  "leadership": { label: "Leadership", category: "Soft", demand: "High" },
  "problem solving": { label: "Problem Solving", category: "Soft", demand: "High" },
  "time management": { label: "Time Management", category: "Soft", demand: "Medium" },
  "adaptability": { label: "Adaptability", category: "Soft", demand: "Medium" },
  "digital marketing": { label: "Digital Marketing", category: "Technical", demand: "High" },
  "seo": { label: "SEO", category: "Technical", demand: "High" },
  "content marketing": { label: "Content Marketing", category: "Technical", demand: "Medium" },
  "accounting": { label: "Accounting", category: "Technical", demand: "High" },
  "bookkeeping": { label: "Bookkeeping", category: "Technical", demand: "High" },
  "quickbooks": { label: "QuickBooks", category: "Tools", demand: "Medium" },
  "customer service": { label: "Customer Service", category: "Soft", demand: "High" },
  "sales": { label: "Sales", category: "Technical", demand: "High" },
  "copywriting": { label: "Copywriting", category: "Technical", demand: "Medium" }
};

const ALIASES = {
  "js": "javascript", "ts": "typescript", "powerbi": "power bi",
  "power-bi": "power bi", "nodejs": "node.js", "node": "node.js",
  "reactjs": "react", "rest": "rest api", "restful": "rest api",
  "ml": "machine learning", "ai": "machine learning",
  "excel spreadsheets": "excel", "ms excel": "excel",
  "postgresql": "sql", "mysql": "sql", "google sheets": "excel",
  "data visualisation": "data visualization", "dataviz": "data visualization",
  "cicd": "ci/cd", "ci cd": "ci/cd", "amazon web services": "aws",
  "ux": "ux design", "ui": "ui design", "figma design": "figma",
  "cyber security": "cybersecurity", "infosec": "cybersecurity",
  "pentesting": "penetration testing", "pen testing": "penetration testing",
  "project manager": "project management", "product manager": "product management"
};

// Role requirement profiles: required skills, preferred skills, tools, certs, education, experience.
const ROLES = {
  "data analyst": {
    label: "Data Analyst",
    required: ["sql", "excel", "data visualization", "statistics", "critical thinking", "communication"],
    preferred: ["python", "power bi", "tableau", "a/b testing"],
    tools: ["Excel", "SQL", "Power BI", "Tableau"],
    certifications: ["Google Data Analytics", "Microsoft PL-300"],
    education: "Bachelor's degree in a quantitative field is commonly requested; strong portfolios can substitute.",
    experience: "0 to 3 years for entry level roles.",
    seniority: ["Intern", "Junior", "Mid-level"]
  },
  "ai evaluation specialist": {
    label: "AI Evaluation Specialist",
    required: ["written english", "attention to detail", "critical thinking", "data annotation"],
    preferred: ["prompt engineering", "llm evaluation", "python", "red teaming"],
    tools: ["Annotation platforms", "Spreadsheets", "LLM interfaces"],
    certifications: [],
    education: "Bachelor's degree commonly requested, often in any field with strong writing ability.",
    experience: "0 to 2 years; writing samples and test tasks matter most.",
    seniority: ["Junior", "Mid-level"]
  },
  "product manager": {
    label: "Product Manager",
    required: ["product management", "prioritization", "stakeholder management", "analytics", "communication"],
    preferred: ["user research", "agile", "sql", "a/b testing"],
    tools: ["Jira", "Figma", "Analytics platforms"],
    certifications: ["CSPO", "PSPO"],
    education: "Bachelor's degree commonly requested; business or technical background helps.",
    experience: "2 to 5 years for most roles.",
    seniority: ["Mid-level", "Senior"]
  },
  "cybersecurity analyst": {
    label: "Cybersecurity Analyst",
    required: ["cybersecurity", "network security", "incident response", "siem", "linux"],
    preferred: ["vulnerability assessment", "penetration testing", "python", "firewalls"],
    tools: ["SIEM platforms", "Firewalls", "Ticketing systems"],
    certifications: ["Security+", "CEH", "CISSP"],
    education: "Bachelor's degree in IT or security, or equivalent certifications plus experience.",
    experience: "1 to 4 years for analyst roles.",
    seniority: ["Junior", "Mid-level", "Senior"]
  },
  "software engineer": {
    label: "Software Engineer",
    required: ["git", "testing", "problem solving", "communication"],
    preferred: ["system design", "ci/cd", "docker", "aws"],
    stackOptions: [["javascript", "react", "node.js"], ["python"], ["java"], ["typescript", "react"]],
    tools: ["Git", "GitHub", "CI/CD pipelines"],
    certifications: [],
    education: "Bachelor's degree in computer science or equivalent practical experience.",
    experience: "0 to 5 years depending on seniority.",
    seniority: ["Intern", "Junior", "Mid-level", "Senior"]
  },
  "ux designer": {
    label: "UX Designer",
    required: ["ux design", "wireframing", "prototyping", "user research", "figma"],
    preferred: ["ui design", "analytics", "html", "css"],
    tools: ["Figma"],
    certifications: ["Google UX Design"],
    education: "Degree or certificate in design; portfolio quality is decisive.",
    experience: "0 to 4 years depending on seniority.",
    seniority: ["Junior", "Mid-level", "Senior"]
  },
  "digital marketer": {
    label: "Digital Marketer",
    required: ["digital marketing", "seo", "analytics", "communication", "copywriting"],
    preferred: ["content marketing", "excel", "a/b testing"],
    tools: ["Google Analytics", "Ad platforms", "Email tools"],
    certifications: ["Google Analytics", "HubSpot"],
    education: "Bachelor's degree in marketing or related field is common.",
    experience: "0 to 3 years for most roles.",
    seniority: ["Junior", "Mid-level"]
  },
  "project manager": {
    label: "Project Manager",
    required: ["project management", "communication", "stakeholder management", "time management", "leadership"],
    preferred: ["agile", "scrum", "jira", "analytics"],
    tools: ["Jira", "MS Project", "Spreadsheets"],
    certifications: ["PMP", "CAPM", "PSM"],
    education: "Bachelor's degree; PMP often preferred for senior roles.",
    experience: "2 to 6 years depending on seniority.",
    seniority: ["Mid-level", "Senior"]
  },
  "data scientist": {
    label: "Data Scientist",
    required: ["python", "statistics", "machine learning", "sql", "critical thinking"],
    preferred: ["r", "data visualization", "aws", "communication"],
    tools: ["Python", "Jupyter", "SQL", "Cloud platforms"],
    certifications: [],
    education: "Bachelor's or Master's in a quantitative field is commonly requested.",
    experience: "1 to 5 years depending on seniority.",
    seniority: ["Junior", "Mid-level", "Senior"]
  },
  "devops engineer": {
    label: "DevOps Engineer",
    required: ["linux", "ci/cd", "docker", "git", "aws"],
    preferred: ["kubernetes", "python", "system design"],
    tools: ["AWS", "Docker", "Kubernetes", "Terraform"],
    certifications: ["AWS Certified", "CKA"],
    education: "Bachelor's degree in IT or equivalent experience.",
    experience: "2 to 5 years for most roles.",
    seniority: ["Mid-level", "Senior"]
  },
  "customer support specialist": {
    label: "Customer Support Specialist",
    required: ["customer service", "communication", "problem solving", "time management"],
    preferred: ["adaptability", "teamwork", "excel"],
    tools: ["Helpdesk software", "CRM"],
    certifications: [],
    education: "High school diploma minimum; degree often preferred.",
    experience: "0 to 2 years.",
    seniority: ["Junior", "Mid-level"]
  },
  "accountant": {
    label: "Accountant",
    required: ["accounting", "bookkeeping", "excel", "attention to detail"],
    preferred: ["quickbooks", "analytics", "communication"],
    tools: ["QuickBooks", "Excel", "ERP systems"],
    certifications: ["CPA", "ACCA", "ICAN"],
    education: "Bachelor's degree in accounting or finance.",
    experience: "0 to 4 years depending on seniority.",
    seniority: ["Junior", "Mid-level", "Senior"]
  }
};

const SAFETY_PATTERNS = [
  { id: "fee", label: "Request for payment or fees", severity: "high", test: /(training fee|recruitment fee|processing fee|registration fee|pay.{0,20}(training|registration|processing|recruitment)?\s?fee|pay(ment)? (a |the )?(deposit|for (training|equipment|uniform|visa|processing))|send (money|payment|us \$)|pay via|gift ?cards?|crypto(graphy|currency)? payment)/i, explain: "Legitimate employers do not ask candidates to pay recruitment, training, equipment or visa fees." },
  { id: "chat_only", label: "Chat-only recruitment", severity: "high", test: /(telegram|whatsapp)( only)?|contact (us |me )?on (telegram|whatsapp)|interview (via|on) (telegram|whatsapp)/i, explain: "Professional recruitment normally uses company email or established job platforms, not chat apps alone." },
  { id: "unrealistic", label: "Unrealistic compensation", severity: "medium", test: /(\$|€|£|₦)\s?\d{2,}(,\d{3})*\s?(per|\/)\s?(day|week)|earn\s+\$?\s?\d[\d,]*(k)?\s*(per|\/|a)?\s*(week|day|month)|earn up to|no experience.*(high|huge|six)|guaranteed income/i, explain: "Very high pay for little or no experience is a common lure. Compare with market rates independently." },
  { id: "pressure", label: "Pressure or urgency tactics", severity: "medium", test: /(act (now|fast)|immediate(ly)? (hire|start|offer)|limited slots|offer expires (today|in \d+ hours)|urgent(ly)? (needed|hiring))/i, explain: "Pressure to accept immediately is unusual in legitimate hiring, which normally allows time for interviews." },
  { id: "sensitive", label: "Request for sensitive personal data", severity: "high", test: /(bank (account|details|login)|credit card|passport (number|copy)|national id|social security|pin code|password|otp|verification code)/i, explain: "Bank logins, card numbers, passwords and one-time codes are never needed during job applications." },
  { id: "download", label: "Suspicious download or software", severity: "high", test: /(download|install).*(app|apk|exe|software|file)|send you a (file|link) to (install|run)|remote access|anydesk|teamviewer/i, explain: "Installing unknown software can compromise your device. Verify the employer through independent channels first." },
  { id: "free_email", label: "Free email for official hiring", severity: "low", test: /@(gmail|yahoo|hotmail|outlook|protonmail|aol)\.com/i, explain: "Established employers usually hire through company domains. Free email alone is not proof of fraud, but verify carefully." },
  { id: "vague", label: "Vague role with high rewards", severity: "low", test: /(no experience (needed|required)|work \d+ (minutes|hours?) (a|per) (day|week)|earn from home.*(thousands|millions)|package (forwarding|receiving)|receive and (forward|resend)|mystery shopper.*(cash|deposit|cheque|check))/i, explain: "Vague duties plus high rewards, or tasks involving forwarding goods or money, deserve extra verification." },
  { id: "domain", label: "Suspicious contact details", severity: "medium", test: /(bit\.ly|tinyurl|t\.me\/|wa\.me\/|\.tk|\.ml|\.ga|\.cf|\.gq)/i, explain: "Shortened links and unusual domains can hide destinations. Check the real company website directly." },
  { id: "inconsistent", label: "Inconsistent employer information", severity: "low", test: /(confidential|undisclosed) (employer|company)|company name.*(withheld|on request)/i, explain: "A legitimate employer can usually be identified. Research the company name, address and registration independently." }
];

const INTERVIEW_BANKS = {
  behavioral: [
    { q: "Tell me about yourself and your background.", criteria: "Clear structure, relevance to the role, concise timeline." },
    { q: "Describe a difficult problem you solved and how you approached it.", criteria: "Problem framing, method, measurable outcome." },
    { q: "Tell me about a time you disagreed with a teammate. How did you handle it?", criteria: "Respectful communication, resolution, learning." },
    { q: "Describe a situation where you missed a deadline or failed. What did you learn?", criteria: "Ownership, corrective action, honesty." },
    { q: "Why are you interested in this role and this organization?", criteria: "Specific motivation, research, role alignment." }
  ],
  situational: [
    { q: "If you were given a task with unclear requirements, what would you do first?", criteria: "Clarifying questions, stakeholder alignment, iteration." },
    { q: "How would you prioritize if three urgent tasks arrived at the same time?", criteria: "Impact assessment, communication, trade-offs." },
    { q: "What would you do in your first 30 days in this role?", criteria: "Learning plan, quick wins, relationship building." }
  ]
};

const ROLE_QUESTIONS = {
  "data analyst": [
    { q: "Explain the difference between WHERE and HAVING in SQL, with an example.", criteria: "Correct semantics, practical example." },
    { q: "How would you handle missing or inconsistent data in a dataset?", criteria: "Diagnosis, treatment options, documentation." },
    { q: "Walk me through a dashboard you built. Who used it and what changed?", criteria: "Audience focus, design choices, impact." }
  ],
  "software engineer": [
    { q: "Explain how you would design a simple REST API for this product area.", criteria: "Resources, methods, status codes, versioning." },
    { q: "How do you debug a production issue you cannot reproduce locally?", criteria: "Logging, reproduction strategy, safe rollout." },
    { q: "Describe your approach to writing testable code.", criteria: "Separation of concerns, test levels, examples." }
  ],
  "product manager": [
    { q: "How do you decide what to build when everything seems important?", criteria: "Frameworks, evidence, stakeholder management." },
    { q: "Describe a product metric you moved and how you did it.", criteria: "Metric choice, experiment, measured result." },
    { q: "How do you handle disagreement with engineering on scope?", criteria: "Trade-offs, shared goals, communication." }
  ],
  "cybersecurity analyst": [
    { q: "Walk me through how you would triage a phishing alert.", criteria: "Containment, evidence, escalation, lessons." },
    { q: "What do you monitor first when joining a new SOC?", criteria: "Baselines, critical assets, alert tuning." },
    { q: "Explain a common attack technique and how to detect it.", criteria: "Technical accuracy, detection logic, tools." }
  ],
  "ai evaluation specialist": [
    { q: "How would you write guidelines for rating the quality of two responses?", criteria: "Clear rubric, examples, edge cases." },
    { q: "What do you do when instructions are ambiguous during an evaluation task?", criteria: "Assumption logging, consistency, escalation." },
    { q: "How do you keep evaluations consistent over long annotation sessions?", criteria: "Calibration, breaks, self review." }
  ],
  "ux designer": [
    { q: "Walk me through your design process from research to handoff.", criteria: "Process clarity, methods, collaboration." },
    { q: "How do you handle feedback that conflicts with user research?", criteria: "Evidence, diplomacy, iteration." },
    { q: "Show how you would improve onboarding for this product.", criteria: "Problem framing, concrete proposal, rationale." }
  ]
};

module.exports = { SKILLS, ALIASES, ROLES, SAFETY_PATTERNS, INTERVIEW_BANKS, ROLE_QUESTIONS };
