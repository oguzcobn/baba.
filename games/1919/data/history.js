import { europe } from "./leaders-europe.js";
import { asia } from "./leaders-asia.js";
import { mena } from "./leaders-mena.js";
import { americas } from "./leaders-americas.js";
import { africa } from "./leaders-africa.js";
import { oceania } from "./leaders-oceania.js";
export const history={...europe,...asia,...mena,...americas,...africa,...oceania};
export const isoOf=id=>({tr:"792",gb:"826",fr:"250",ru:"643",gr:"300"}[id]||id.replace(/^c/,""));
export const branchNames={K:"Kara",T:"Topçu",Z:"Zırhlı",H:"Hava",D:"Deniz",S:"Süvari",M:"Kurmay"};
export function historicalCard(id,era){return history[isoOf(id)]?.[era-1];}
export function officer(s,id,era){
 const people=historicalCard(id,era)?.officers||[],slot=s.commands?.[id];
 return people[slot?.era===era?slot.index:0]||people[0];
}
export const spirits={
 "792":["Anadolu demiryolları","civil"],"031":["Bakü petrol sahaları","fuel"],"840":["Seri üretim","arms"],
 "643":["Ağır sanayi","arms"],"826":["Denizaşırı tersaneler","yard"],"250":["Teknik okullar","study"],
 "276":["Takım tezgâhları","arms"],"380":["Akdeniz tersaneleri","yard"],"392":["Ada tersaneleri","yard"],
 "156":["Bölgesel atölyeler","civil"],"300":["Ege denizciliği","yard"],"364":["Petrol havzaları","fuel"],
 "356":["Demiryolu ağı","civil"],"410":["Teknik eğitim","study"],"376":["Araştırma kurumları","study"],
 "804":["Metalürji merkezleri","arms"],"616":["Merkez sanayi bölgesi","arms"],"076":["Kıtasal altyapı","civil"],
 "818":["Nil ulaşım ağı","civil"],"724":["Atlantik tersaneleri","yard"],"586":["İndus havzası","civil"],
 "682":["Petrol ekonomisi","fuel"],"124":["Demiryolu koridorları","civil"],"036":["Kıyı lojistiği","yard"],
 "360":["Takımada denizciliği","yard"],"484":["Körfez petrol sahaları","fuel"],"710":["Madencilik sanayisi","arms"],
 "032":["Pampa demiryolları","civil"],"752":["Mühendislik enstitüleri","study"],"528":["Gemi inşa geleneği","yard"]
};
const regionalIndex=new Map([europe,asia,mena,americas,africa,oceania].flatMap((r,i)=>Object.keys(r).map(iso=>[iso,i])));
export function uniformRegion(id){return regionalIndex.get(isoOf(id))??0;}
