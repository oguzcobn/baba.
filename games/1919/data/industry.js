export const resources = {
  steel:["Çelik",2], aluminium:["Alüminyum",3], oil:["Petrol",2],
  fuel:["Yakıt",3], chips:["Yarı iletken",5]
};

// Required construction work, budget, steel and occupied slots.
export const buildings = {
  civil:["Sivil fabrika",48,24,6,1,"İnşaata ayda 4 iş"],
  arms:["Askerî fabrika",60,32,10,1,"Bir kara veya hava üretim hattı"],
  yard:["Tersane",96,50,16,2,"Kıyıda bir deniz üretim hattı"],
  refinery:["Sentetik rafineri",72,36,8,1,"3 petrol → 4 yakıt; petrol yoksa 2 bütçe → 2 yakıt"],
  depot:["İkmal merkezi",60,26,6,1,"Eyalette aynı anda bir ek eğitim"],
  infra:["Altyapı",36,16,4,0,"Yerel maden ve petrol üretimi +%15, en çok 3"],
  airbase:["Hava / İHA üssü",54,28,6,1,"Hava ve insansız hava birliklerine eğitim"],
  radar:["Radar ve elektronik harp",66,34,8,1,"Elektronik ve insansız sistem araştırmasına +%10"],
  electronics:["Elektronik sanayisi",90,45,8,1,"2 alüminyum + 2 bütçe → 2 yarı iletken"]
};
export const branches = {
  land:["Kara / Zırhlı","Piyade ve hafif zırh","Mekanizasyon","Ana muharebe tankı","Sayısal zırhlı birlik","Aktif koruma"],
  air:["Hava","Çift kanatlı havacılık","Yakın hava desteği","Jet motorları","Çok rollü uçak","Düşük görünürlük"],
  uav:["İHA / SİHA","Fotoğraf keşfi","Uzaktan kumanda","Keşif İHA","Taktik İHA / MALE","Jet SİHA ve sürüler"],
  navy:["Donanma","Muhrip ve torpidobot","Denizaltı ve taşıyıcı","Füzeli eskort","Filo hava savunması","Çok amaçlı LHD"],
  usv:["İnsansız deniz","Seyir ölçümü","Uzaktan kumanda deneyleri","Deniz telemetrisi","Keşif İDA","Silahlı ve DSH İDA"],
  industry:["Sanayi / Elektronik","Takım tezgâhları","Seri imalat","Elektronik bakım","Yarı iletkenler","Otomasyon"]
};
export const researchCost=[0,18,30,48,64,80];
export const focusNames=[
  ["Demiryolu programı","Eğitim seferberliği","Ulusal planlama"],
  ["Seri üretim","İaşe ağı","Standardizasyon"],
  ["Jet bakım okulları","Enerji yatırımı","Araştırma enstitüsü"],
  ["Mikroelektronik","Lojistik ağı","Sayısal ağ"],
  ["Otomasyon","Dayanıklı tedarik","Modernizasyon"]
];
export const laws={
  economy:["Ekonomi","Sivil","Karma","Seferber"],
  service:["Askere alma","Gönüllü","Sınırlı","Genel"],
  trade:["Ticaret","Açık","Dengeli","Korumacı"]
};
// Output batches feed the equipment store before deployment.
export const families={
  rifle:{name:"Piyade teçhizatı",branch:"land",first:1,work:6,steel:1},
  gun:{name:"Destek topçusu",branch:"land",first:1,work:12,steel:2},
  tank:{name:"Zırhlı araç",branch:"land",first:1,work:36,steel:6,aluminium:1},
  plane:{name:"Hava aracı",branch:"air",first:1,work:42,steel:2,aluminium:6},
  drone:{name:"İnsansız hava aracı",branch:"uav",first:3,work:18,steel:1,aluminium:2},
  ship:{name:"Harp gemisi",branch:"navy",first:1,work:72,steel:10,aluminium:2},
  usv:{name:"İnsansız deniz aracı",branch:"usv",first:4,work:24,steel:2,aluminium:1}
};
export const units={
  infantry:["Piyade",10,8,{rifle:4}],motor:["Motorlu birlik",12,10,{rifle:4,tank:2}],
  tank:["Zırhlı birlik",10,12,{tank:3,gun:2}],plane:["Hava filosu",3,12,{plane:3}],
  drone:["İHA filosu",3,10,{drone:2}],ship:["Deniz grubu",4,8,{ship:1}],usv:["İDA grubu",2,8,{usv:2}]
};
export const numerals=["","I","II","III","IV","V"];
export function eraAt(month){
  const year=1919+Math.floor((4+month)/12);
  return 1+[1936,1950,1990,2015].filter(y=>year>=y).length;
}
export function recipe(key,level){
  const f=families[key];
  const factor=[0,1,1,1.15,1.25,1.45][level];
  return {name:f.name+" "+numerals[level], work:Math.ceil(f.work*[0,1,1.15,1.35,1.6,1.9][level]),
    yard:["ship","usv"].includes(key), inputs:{steel:Math.ceil(f.steel*factor),aluminium:Math.ceil((f.aluminium||0)*factor),
    chips:level>=4&&!["rifle","gun"].includes(key)?level-3:0}};
}
