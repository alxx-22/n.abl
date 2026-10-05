// What differs between the four nations for a repairs contractor: who to
// ring about gas, flooding and fraud, the alarm and damp rules, where
// tenants get advice (presets/property-maintenance.md §4.2). The safety
// scripts are fixed, not answers: an owner can see them in the builder but
// never edit them, because the first minute of a gas call is not a place for
// house style. Imports only types, so the builder can show the very scripts
// the receptionist reads.

import type { MtNation } from './answers.ts';

export interface MtNationPack {
  /** "England", for "We work in England". */
  name: string;
  gas: { who: string; number: string };
  /** Where someone feeling ill is sent when it isn't a 999 emergency. */
  medical: string;
  /** Who to ring about a burst main or no water. */
  water: string;
  flood: { who: string; number: string };
  alarms: string;
  /** How a gas safety record renews; Great Britain allows the early renewal that keeps the date. */
  gasRecord: string;
  damp: string;
  tenants: string;
  asbestos: string;
  fraud: string;
}

const GB_GAS = { who: 'the National Gas Emergency Service', number: '0800 111 999' };
const FLOODLINE = { who: 'Floodline', number: '0345 988 1188' };
const GB_GAS_RECORD = 'A landlord needs a gas safety check every 12 months by a Gas Safe registered engineer. It can be done from 10 months on without losing the date, so booking early costs nothing.';
const REPORT_FRAUD = 'Report Fraud on 0300 123 2040';

export const MT_NATION_PACKS: Record<MtNation, MtNationPack> = {
  england: {
    name: 'England',
    gas: GB_GAS,
    medical: 'NHS 111',
    water: 'your water company: the number is on your water bill',
    flood: FLOODLINE,
    alarms: "Landlords in England must fit a smoke alarm on every storey and a carbon monoxide alarm in any room with a fixed fuel-burning appliance, like a boiler or wood burner (not a gas cooker), and repair or replace them when told they're faulty.",
    gasRecord: GB_GAS_RECORD,
    damp: "For social housing in England, Awaab's Law sets time limits for landlords to look into and fix damp and mould. Any tenant can get advice from Shelter or Citizens Advice.",
    tenants: 'Shelter or Citizens Advice can explain a tenant\'s rights about repairs.',
    asbestos: "the HSE's asbestos guidance",
    fraud: REPORT_FRAUD,
  },
  wales: {
    name: 'Wales',
    gas: GB_GAS,
    medical: 'NHS 111 Wales',
    water: 'your water company, usually Dŵr Cymru Welsh Water: the number is on your water bill',
    flood: FLOODLINE,
    alarms: 'Landlords in Wales must fit mains-powered, linked smoke alarms on every storey, and a carbon monoxide alarm in any room with a gas, oil or solid fuel appliance.',
    gasRecord: GB_GAS_RECORD,
    damp: 'Landlords in Wales must keep a home fit to live in, damp and mould included. Shelter Cymru or Citizens Advice can advise.',
    tenants: 'Shelter Cymru or Citizens Advice can explain a tenant\'s rights about repairs.',
    asbestos: "the HSE's asbestos guidance",
    fraud: REPORT_FRAUD,
  },
  scotland: {
    name: 'Scotland',
    gas: GB_GAS,
    medical: 'NHS 24 on 111',
    water: 'Scottish Water: the number is on their website',
    flood: FLOODLINE,
    alarms: "Every home in Scotland needs linked smoke and heat alarms: a smoke alarm in the living room and on every hall and landing, a heat alarm in the kitchen, and a carbon monoxide alarm where there's a fuel-burning appliance or flue.",
    gasRecord: GB_GAS_RECORD,
    damp: "From 6 October 2026, Scotland's rules set time limits for landlords to look into and fix damp and mould. Shelter Scotland or Citizens Advice can advise.",
    tenants: 'Shelter Scotland or Citizens Advice can explain a tenant\'s rights about repairs.',
    asbestos: "the HSE's asbestos guidance",
    fraud: 'Police Scotland on 101',
  },
  northern_ireland: {
    name: 'Northern Ireland',
    gas: { who: 'the Northern Ireland Gas Emergency Service', number: '0800 002 001' },
    medical: "your GP or the out-of-hours GP service",
    water: 'NI Water: the number is on their website',
    flood: { who: 'the Flooding Incident Line', number: '0300 2000 100' },
    alarms: 'Landlords in Northern Ireland must fit smoke, heat and carbon monoxide alarms under the private tenancy rules.',
    gasRecord: 'A landlord needs a gas safety check every 12 months by a Gas Safe registered engineer.',
    damp: 'Housing Advice NI or Citizens Advice can explain what a landlord must do about damp and mould.',
    tenants: 'Housing Advice NI or Citizens Advice can explain a tenant\'s rights about repairs.',
    asbestos: "HSENI's asbestos guidance",
    fraud: REPORT_FRAUD,
  },
};

export const SAFETY_KINDS = ['gas', 'co', 'co_chirp', 'fire', 'electric', 'water', 'flood', 'break_in', 'lockout', 'structural'] as const;
export type SafetyKind = (typeof SAFETY_KINDS)[number];

/** Logged with every incident, so the safety log says which wording the caller heard. */
export const SAFETY_VERSION = 1;

export interface SafetyScript {
  kind: SafetyKind;
  /** "A smell of gas", for the builder and the safety log. */
  title: string;
  /** Said in this order; the first is the one that must never wait. */
  steps: string[];
  /** The number the caller must hear, said twice in groups. */
  number?: string;
  /** What the receptionist does next. */
  next: string;
  /** The text sent at once, when there is a number to keep. */
  text?: string;
}

/** The fixed script for one kind of emergency, in the nation's numbers. */
export function safetyScript(kind: SafetyKind, nation: MtNation): SafetyScript {
  const p = MT_NATION_PACKS[nation];
  const gas = `${p.gas.who} on ${p.gas.number}`;
  switch (kind) {
    case 'gas':
      return {
        kind, title: 'A smell of gas',
        steps: [
          'Get everyone out of the property now.',
          "Open doors and windows on the way out, if it's safe to.",
          "Don't use any switches, plugs or anything with a flame, and don't smoke.",
          "Turn the gas off at the meter, if it's safe to reach.",
          `Ring ${gas} from outside.`,
        ],
        number: p.gas.number,
        next: 'Tell them to hang up and ring from outside; end the call.',
        text: `${p.gas.who.replace(/^the /, '').replace(/^./, (c) => c.toUpperCase())}: ${p.gas.number}. Leave the property, then ring from outside. Once it's made safe, call us to book a Gas Safe repair.`,
      };
    case 'co':
      return {
        kind, title: 'A carbon monoxide alarm, or feeling ill from fumes',
        steps: [
          'Get everyone out into fresh air now, and leave the doors open.',
          "Turn off any gas, oil or solid fuel appliance if it's safe to, and don't go back in.",
          `Ring ${gas}.`,
          `If anyone feels ill, with a headache, dizziness or sickness, get medical help: 999 in an emergency, or ${p.medical}.`,
        ],
        number: p.gas.number,
        next: 'Tell them to hang up and ring from outside; end the call.',
        text: `Carbon monoxide: stay out in fresh air and ring ${gas}. If anyone feels ill, ring 999.`,
      };
    case 'co_chirp':
      return {
        kind, title: 'A carbon monoxide alarm chirping',
        steps: [
          `If the alarm is sounding all the time, treat it as carbon monoxide: everyone out, and ring ${gas}.`,
          "A single chirp every minute or so, with nobody feeling ill, usually means the battery is low or the alarm is at the end of its life.",
          'We can send someone to replace it.',
        ],
        number: p.gas.number,
        next: 'If it is the full alarm, follow the carbon monoxide script; otherwise book a routine visit.',
      };
    case 'fire':
      return {
        kind, title: 'Fire or smoke',
        steps: ['Get everyone out and stay out.', 'Ring 999 and ask for the fire service.', "Don't go back in for anything."],
        number: '999',
        next: 'End the call so they can ring 999.',
      };
    case 'electric':
      return {
        kind, title: 'Sparks, a burning smell, or water near electrics',
        steps: [
          "Don't touch anything wet, sparking or hot.",
          "If the fuse box is dry and safe to reach, switch the power off at the main switch. Don't touch anything else in it.",
          'If there is smoke or fire, get out and ring 999.',
          'For a power cut in the street, ring 105.',
        ],
        next: 'Once they are safe, book an emergency electrician.',
      };
    case 'water':
      return {
        kind, title: 'A leak or burst pipe',
        steps: [
          'Turn the water off at the stopcock: it is often under the kitchen sink.',
          "If water is near electrics or coming through a light, don't touch the switches; switch the power off at the main switch only if it's dry and safe to reach.",
          "Catch what you can in buckets and move valuables, if it's safe.",
        ],
        next: 'Once they are safe, book an emergency plumber.',
      };
    case 'flood':
      return {
        kind, title: 'Flooding, or a burst main in the street',
        steps: [
          'Keep away from flood water: it can hide open drains and carry sewage.',
          "Switch the power off at the main switch only if it's dry and safe to reach.",
          `A burst main in the street is for ${p.water}.`,
          `For flood warnings, ring ${p.flood.who} on ${p.flood.number}. In danger, ring 999.`,
        ],
        number: p.flood.number,
        next: 'Once they are safe, book a make-safe visit for the property.',
      };
    case 'break_in':
      return {
        kind, title: 'A break-in',
        steps: [
          'If someone may still be inside, or it is happening now, get somewhere safe and ring 999.',
          'Otherwise ring the police on 101 for a crime number.',
          "Try not to touch anything the police might need to see.",
        ],
        number: '999',
        next: 'Once the police have it, book boarding up or new locks.',
      };
    case 'lockout':
      return {
        kind, title: 'Locked out',
        steps: [
          'If a child or someone vulnerable is inside alone, or a cooker or tap is left on, ring 999.',
          'Otherwise we can send a locksmith, who will need to see proof that you live there.',
        ],
        next: 'Book a locksmith, saying the lockout price first.',
      };
    case 'structural':
      return {
        kind, title: 'A ceiling, wall or chimney that may fall',
        steps: [
          'Keep everyone away from it, and out of the room below.',
          "If it is falling now, or anyone is hurt, ring 999.",
          "Don't climb up to look.",
        ],
        next: 'Book an emergency make-safe visit.',
      };
  }
}

/** Every script, for the builder's Safety step. */
export const safetyScripts = (nation: MtNation): SafetyScript[] => SAFETY_KINDS.map((k) => safetyScript(k, nation));

/** The gas emergency line, said as a core fact: an emergency must never wait for a tool. */
export const gasFact = (n: MtNation) => `Gas emergency: ${MT_NATION_PACKS[n].gas.who}, ${MT_NATION_PACKS[n].gas.number}.`;

/** The nation's rules and the official places to ask, for search_knowledge. The business's own asbestos answer names the guidance. */
export function nationKnowledge(n: MtNation): { q: string; a: string; tags: string[] }[] {
  const p = MT_NATION_PACKS[n];
  return [
    { q: 'There is a power cut.', a: 'For a power cut, ring 105: it is free and puts you through to your local network operator.', tags: ['power cut', 'no power', 'electricity', '105'] },
    { q: 'Who do I ring about a burst water main?', a: `A burst main or no water in the street is for ${p.water}.`, tags: ['water main', 'no water', 'water pressure', 'street'] },
    { q: 'Who do I ring about flooding?', a: `For flood warnings, ring ${p.flood.who} on ${p.flood.number}. If anyone is in danger, ring 999.`, tags: ['flood', 'flooding', 'river'] },
    { q: 'What alarms must a landlord fit?', a: p.alarms, tags: ['smoke alarm', 'carbon monoxide alarm', 'heat alarm', 'alarm'] },
    { q: 'How often does a landlord need a gas safety check?', a: p.gasRecord, tags: ['gas safety', 'gas certificate', 'cp12', 'landlord'] },
    { q: 'How often do the electrics need checking?', a: 'Landlords must have the electrics checked by a qualified electrician at least every five years, with an electrical installation condition report.', tags: ['eicr', 'electrical', 'certificate', 'landlord'] },
    { q: 'What must a landlord do about damp and mould?', a: p.damp, tags: ['damp', 'mould', 'condensation', "awaab's law"] },
    { q: "I'm a tenant and my repairs aren't being done.", a: `${p.tenants} I can take the details of the repair for whoever looks after the property.`, tags: ['tenant', 'rights', 'landlord', 'complaint'] },
    {
      q: 'Someone told me your bank details have changed.',
      a: `We never change bank details by email or text. Don't pay anything: check with us on a number you already have, and report it to ${p.fraud}.`,
      tags: ['fraud', 'bank details', 'scam', 'invoice'],
    },
  ];
}
