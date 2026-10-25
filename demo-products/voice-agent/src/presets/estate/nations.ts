// What differs between England, Wales and Northern Ireland for someone
// buying a home: the local tax, the purchase tax, where to check flood risk,
// the gas emergency number, where tenants get advice, and the equality law
// (presets/estate-agent.md §4.2). Compiled into knowledge entries, which
// name each official service ("on GOV.UK") and never read a web address out.
// Scotland works differently and is not offered.

import type { EstateSettings, KnowledgeEntry, Nation } from '../../domain/types.ts';

export interface NationPack {
  /** "England", for "We sell homes in England". */
  name: string;
  localTax: string;
  purchaseTax: string;
  flood: string;
  /** Who to ring about a gas leak, and the number. */
  gas: { who: string; number: string };
  tenants: string;
  equality: string;
  /** The official services named when a home's details don't say: never a web address. */
  official: { flooding: string; local_tax: string };
}

export const NATION_PACKS: Record<Nation, NationPack> = {
  england: {
    name: 'England',
    localTax: "Council tax bands are on the Valuation Office Agency's council tax band checker on GOV.UK.",
    purchaseTax: "We can't advise on tax, but HMRC's Stamp Duty Land Tax calculator on GOV.UK gives the figure, and your solicitor will confirm it.",
    flood: "You can check the long-term flood risk for any address on the Environment Agency's flood risk service on GOV.UK.",
    gas: { who: 'the National Gas Emergency Service', number: '0800 111 999' },
    tenants: 'Shelter or Citizens Advice can explain a tenant\'s rights when the home they rent is being sold.',
    equality: 'the Equality Act 2010',
    official: { flooding: "the Environment Agency's long-term flood risk service on GOV.UK", local_tax: "the Valuation Office Agency's council tax band checker on GOV.UK" },
  },
  wales: {
    name: 'Wales',
    localTax: "Council tax bands in Wales run from A to I; you can check one with the Valuation Office Agency's checker on GOV.UK.",
    purchaseTax: "In Wales it's Land Transaction Tax rather than stamp duty. We can't advise on tax, but the Welsh Revenue Authority's calculator on GOV.WALES gives the figure, and your solicitor will confirm it.",
    flood: "You can check flood risk for any address on Natural Resources Wales's flood risk map.",
    gas: { who: 'the National Gas Emergency Service', number: '0800 111 999' },
    tenants: 'Shelter Cymru or Citizens Advice can explain a tenant\'s rights when the home they rent is being sold.',
    equality: 'the Equality Act 2010',
    official: { flooding: "Natural Resources Wales's flood risk map", local_tax: "the Valuation Office Agency's council tax band checker on GOV.UK" },
  },
  northern_ireland: {
    name: 'Northern Ireland',
    localTax: "Homes in Northern Ireland pay domestic rates rather than council tax; Land and Property Services has a rates calculator on nidirect.",
    purchaseTax: "We can't advise on tax, but HMRC's Stamp Duty Land Tax calculator on GOV.UK gives the figure, and your solicitor will confirm it.",
    flood: 'You can check flood risk for any address on the Department for Infrastructure\'s Flood Maps NI.',
    gas: { who: 'the Northern Ireland Gas Emergency Service', number: '0800 002 001' },
    tenants: 'The Housing Advice NI service can explain a tenant\'s rights when the home they rent is being sold.',
    equality: 'the Fair Employment and Treatment (Northern Ireland) Order 1998 and the Race Relations (Northern Ireland) Order 1997',
    official: { flooding: "the Department for Infrastructure's Flood Maps NI", local_tax: "Land and Property Services' rates calculator on nidirect" },
  },
};

/** Where a buyer checks what a home's details leave out, by the nation's own services. */
export const officialSources = (n: Nation): NonNullable<EstateSettings['official']> => ({
  ...NATION_PACKS[n].official,
  broadband: "Ofcom's broadband and mobile checker",
  mobile: "Ofcom's broadband and mobile checker",
});

/** The gas emergency line, said as a core fact: an emergency at a home must never wait for a tool. */
export const gasFact = (n: Nation) => `Gas emergency: call ${NATION_PACKS[n].gas.who} on ${NATION_PACKS[n].gas.number}.`;

/** The official places a buyer checks for themselves, in the nation's own words. */
export function nationKnowledge(n: Nation): KnowledgeEntry[] {
  const p = NATION_PACKS[n];
  const englandOrWales = n !== 'northern_ireland';
  return [
    { q: n === 'northern_ireland' ? 'How much are the rates?' : 'How do I check the council tax band?', a: p.localTax, tags: ['council tax', 'band', 'rates', 'tax'] },
    { q: n === 'wales' ? 'How much Land Transaction Tax will I pay?' : 'How much stamp duty will I pay?', a: p.purchaseTax, tags: ['stamp duty', 'land transaction tax', 'tax'] },
    { q: 'Is it at risk of flooding?', a: p.flood, tags: ['flood', 'flooding', 'river'] },
    { q: 'I can smell gas at a property.', a: `Leave the property, don't use any switches, and call ${p.gas.who} on ${p.gas.number}. In danger, call 999.`, tags: ['gas', 'smell', 'leak', 'emergency'] },
    { q: "I'm a tenant in a home that's being sold.", a: `${p.tenants} I can take a message for the team with the times that suit you for viewings.`, tags: ['tenant', 'renting', 'evict', 'notice'] },
    { q: 'What broadband and mobile signal is there?', a: "Ofcom's broadband and mobile checker shows what's available at any address.", tags: ['broadband', 'internet', 'mobile', 'signal'] },
    { q: 'Where can I see the energy performance certificate?', a: 'Every EPC is on the energy performance certificate register on GOV.UK, and I can text you the link we have.', tags: ['epc', 'energy'] },
    { q: 'Is the area safe?', a: 'Crime figures for any street are on police.uk. I can give you facts about the home, but not opinions about who lives nearby.', tags: ['crime', 'safe', 'area', 'police'] },
    ...(englandOrWales
      ? [
          { q: 'What did houses on the street sell for?', a: 'Sold prices are published by HM Land Registry on GOV.UK.', tags: ['sold', 'price', 'land registry'] },
          { q: 'How do I protect my own home from fraud?', a: "HM Land Registry's free Property Alert service on GOV.UK tells you if anyone tries to change the register for your home.", tags: ['fraud', 'property alert', 'title'] },
        ]
      : []),
    {
      q: 'Someone asked me to pay to hold a home, or told me bank details have changed.',
      a: "Don't pay anything. Check with your own solicitor on a number you already have, and report it to Report Fraud on 0300 123 2040. We never change bank details by email or text.",
      tags: ['fraud', 'bank', 'deposit', 'pay', 'scam'],
    },
    { q: "I'm struggling and need someone to talk to.", a: "Samaritans are there day and night on 116 123, free. I'm sorry things are hard.", tags: ['samaritans', 'struggling', 'upset'] },
    { q: 'Do you treat everyone the same?', a: `Yes. We treat every buyer and seller the same, as ${p.equality} requires, and we describe homes, never who lives nearby.`, tags: ['discrimination', 'equality', 'fair'] },
    { q: 'Do you sell homes in Scotland?', a: `No: buying and selling in Scotland works differently, and we sell homes in ${p.name}.`, tags: ['scotland'] },
    { q: 'Do you sell commercial property or land?', a: 'We sell homes only, not commercial property or land.', tags: ['commercial', 'land', 'business', 'shop'] },
  ];
}
