const CHEAT_SITES = [
  { name: 'Medusa-Cheat', domains: ['medusa-cheat.pro', 'medusa-cheat.ru', 'medusa-cheat.com'] },
  { name: 'Vanish', domains: ['vanishcheat.com', 'vanish.xyz', 'runvanishsince.art'] },
  { name: 'Binware', domains: ['binware.su', 'binware.club', 'binware.net'] },
  { name: 'Leet-Cheats', domains: ['leet-cheats.ru', 'leet-cheats.com', 'leetcheats.ru'] },
  { name: 'Skript', domains: ['skript.gg', 'skript.su', 'skript.net'] },
  { name: 'Unicorn', domains: ['unicore.cloud', 'unicorncheats.ru', 'unicorncheats.com'] },
];

const MARKETPLACES = [
  { name: 'FunPay', domains: ['funpay.ru', 'funpay.com'] },
  { name: 'Playerok', domains: ['playerok.ru', 'playerok.com'] },
  { name: 'GGSel', domains: ['ggsel.com', 'ggsel.ru', 'ggsel.net'] },
];

const POPULAR_EMAILS = [
  { name: 'Gmail', domains: ['gmail.com'] },
  { name: 'Mail.ru', domains: ['mail.ru', 'inbox.ru', 'bk.ru', 'list.ru'] },
  { name: 'Yandex', domains: ['yandex.ru', 'yandex.ua', 'yandex.by', 'ya.ru'] },
  { name: 'Outlook', domains: ['outlook.com', 'hotmail.com', 'live.com', 'msn.com'] },
  { name: 'iCloud', domains: ['icloud.com', 'me.com', 'mac.com'] },
  { name: 'ProtonMail', domains: ['protonmail.com', 'proton.me'] },
  { name: 'RAMBLER', domains: ['rambler.ru', 'ro.ru'] },
  { name: 'UKR.NET', domains: ['ukr.net'] },
];

const IGNORED_DOMAINS = [
  'google.com', 'chromium.org', 'googleapis.com', 'gstatic.com',
  'googleusercontent.com', 'ggpht.com', '2mdn.net', 'doubleclick.net',
  'googlesyndication.com', 'googleadservices.com', 'google-analytics.com',
  'leetcode.com', 'leetcode.cn', 'b2clogin.com', 'co.uk',
  'e-szigno.hu', 'izenpe.com', 'example.com', 'test.com', 'localhost'
];

const IGNORED_EMAIL_PATTERNS: RegExp[] = [
  /^info@/i, /^admin@/i, /^support@/i, /^no-?reply@/i,
  /^noreply@/i, /^donotreply@/i, /^contact@/i, /^webmaster@/i,
  /^postmaster@/i, /^mailer-daemon@/i, /^abuse@/i, /^root@/i,
  /^service@/i, /^help@/i, /^feedback@/i, /^test@/i, /^user@/i
];

const VALID_EMAIL_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export interface EmailResult {
  email: string;
  provider: string;
  line: number;
  context: string;
}

export interface CheatSiteResult {
  site: string;
  domain: string;
  line: number;
  context: string;
}

export interface MarketplaceResult {
  name: string;
  domain: string;
  line: number;
  context: string;
}

export interface ParseResult {
  filename: string;
  totalLines: number;
  processedLines: number;
  emails: EmailResult[];
  cheatSites: CheatSiteResult[];
  marketplaces: MarketplaceResult[];
}

function isCodeLine(line: string): boolean {
  const trimmed = line.trim();
  
  const codePatterns: RegExp[] = [
    /^[\s{]*['"]?\w+['"]?\s*:\s*[\[{]/, /^[\s{]*domains\s*:/, /^[\s{]*name\s*:/,
    /^[\s{]*const\s+/, /^[\s{]*let\s+/, /^[\s{]*var\s+/, /^[\s{]*function\s+/,
    /^[\s{]*import\s+/, /^[\s{]*export\s+/, /^[\s{]*module\./, /^[\s{]*require\s*\(/,
    /^[\s{]*console\./, /^[\s{]*if\s*\(/, /^[\s{]*for\s*\(/, /^[\s{]*while\s*\(/,
    /^[\s{]*return\s+/, /^[\s{]*\}\s*[,;]?\s*$/, /^[\s{]*\]\s*[,;]?\s*$/,
    /^[\s{]*\)\s*[,;]?\s*$/, /^[\s{]*\.\w+/, /^[\s{]*\/\//, /^[\s{]*\/\*/,
    /^[\s{]*\*\//, /^[\s{]*</, /^[\s{]*>/, /^[\s{]*\{$/, /^[\s{]*\}$/,
    /^[\s{]*,\s*$/, /^[\s{]*;\s*$/, /^\s*\[\s*$/
  ];

  return codePatterns.some((pattern: RegExp) => pattern.test(trimmed));
}

function getEmailProvider(domain: string): string {
  const lowerDomain = domain.toLowerCase();
  for (const popular of POPULAR_EMAILS) {
    if (popular.domains.some((d: string) => lowerDomain === d || lowerDomain.endsWith('.' + d))) {
      return popular.name;
    }
  }
  return 'Другое';
}

function isValidEmail(email: string): boolean {
  const lowerEmail = email.toLowerCase();
  const parts = email.split('@');
  
  if (parts.length !== 2) return false;
  
  const domain = parts[1].toLowerCase();
  const localPart = parts[0].toLowerCase();
  
  if (localPart.length < 2 || localPart.length > 50) return false;
  if (!VALID_EMAIL_PATTERN.test(lowerEmail)) return false;
  if (IGNORED_DOMAINS.some((d: string) => domain === d || domain.endsWith('.' + d))) return false;
  if (IGNORED_EMAIL_PATTERNS.some((p: RegExp) => p.test(lowerEmail))) return false;
  
  return true;
}

function findCheatSite(text: string): { name: string; domain: string } | null {
  const lowerText = text.toLowerCase();
  
  for (const cheat of CHEAT_SITES) {
    for (const domain of cheat.domains) {
      if (lowerText.includes(domain.toLowerCase())) {
        return { name: cheat.name, domain: domain };
      }
    }
  }
  
  return null;
}

function findMarketplace(text: string): { name: string; domain: string } | null {
  const lowerText = text.toLowerCase();
  
  for (const marketplace of MARKETPLACES) {
    for (const domain of marketplace.domains) {
      if (lowerText.includes(domain.toLowerCase())) {
        return { name: marketplace.name, domain: domain };
      }
    }
  }
  
  return null;
}

export function parseLogFile(fileContent: string, filename: string): ParseResult {
  const lines = fileContent.split('\n');
  const emails: EmailResult[] = [];
  const cheatSites: CheatSiteResult[] = [];
  const marketplaces: MarketplaceResult[] = [];
  const seenEmails = new Set<string>();
  const seenCheats = new Set<string>();
  const seenMarketplaces = new Set<string>();
  let processedLines = 0;

  const emailRegex = /[a-zA-Z0-9][a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) continue;
    if (isCodeLine(line)) continue;
    
    const foundEmails: string[] = [];
    let emailMatch: RegExpExecArray | null;
    const emailRegexCopy = new RegExp(emailRegex.source, 'g');
    
    while ((emailMatch = emailRegexCopy.exec(line)) !== null) {
      foundEmails.push(emailMatch[0]);
    }
    
    const cheatSite = findCheatSite(line);
    const marketplace = findMarketplace(line);
    
    if (foundEmails.length > 0 || cheatSite || marketplace) {
      processedLines++;
      
      for (const email of foundEmails) {
        if (!seenEmails.has(email.toLowerCase()) && isValidEmail(email)) {
          seenEmails.add(email.toLowerCase());
          const domain = email.split('@')[1];
          emails.push({
            email: email.toLowerCase(),
            provider: getEmailProvider(domain),
            line: i + 1,
            context: line
          });
        }
      }
      
      if (cheatSite) {
        const key = `${cheatSite.name}:${cheatSite.domain}`;
        if (!seenCheats.has(key)) {
          seenCheats.add(key);
          cheatSites.push({
            site: cheatSite.name,
            domain: cheatSite.domain,
            line: i + 1,
            context: line
          });
        }
      }
      
      if (marketplace) {
        const key = `${marketplace.name}:${marketplace.domain}`;
        if (!seenMarketplaces.has(key)) {
          seenMarketplaces.add(key);
          marketplaces.push({
            name: marketplace.name,
            domain: marketplace.domain,
            line: i + 1,
            context: line
          });
        }
      }
    }
  }

  return {
    filename,
    totalLines: lines.length,
    processedLines,
    emails,
    cheatSites,
    marketplaces,
  };
}