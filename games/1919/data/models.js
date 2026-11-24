// Each row is a research-gated game model. Work and strengths are game units.
const rows=[
 ["rifle","rifle","land",1,"line",0,1,"Piyade takımı|Destekli piyade|Motorlu piyade|Profesyonel piyade|Ağ destekli piyade"],
 ["gun","gun","land",1,"support",0,1,"Sahra topçusu|Çekili ağır topçu|Kundağı motorlu topçu|Sayısal topçu|Modern destek bataryası"],
 ["tank","tank","land",1,"armour",2,1,"Hafif tank|Orta tank|I. nesil ana muharebe tankı|III. nesil ana muharebe tankı|Aktif korumalı tank"],
 ["plane","plane","air",1,"air",3,1,"Çift kanatlı avcı|Pervaneli avcı|Jet avcı|4,5 nesil çok rollü uçak|5. nesil uçak"],
 ["ship","ship","navy",1,"escort",3,1,"Muhrip|Filo muhribi|Füzeli fırkateyn|Modern eskort|Yeni nesil fırkateyn"],
 ["drone","drone","uav",3,"recon",1,1,"Keşif drone’u|Taktik İHA|Uzun havada kalışlı İHA"],
 ["usv","usv","usv",4,"recon",1,1,"Keşif İDA|Açık deniz keşif İDA"],
 ["cavalry","rifle","land",1,"mobile",0,1.15,"Süvari"],
 ["scoutcar","tank","land",1,"mobile",1,.65,"Hafif zırhlı otomobil"],
 ["heavy","tank","land",2,"armour",3,1.45,"Ağır tank|II. nesil ana muharebe tankı"],
 ["ifv","tank","land",2,"mobile",1.5,.78,"Mekanize piyade taşıyıcısı|Zırhlı muharebe aracı|Modern ZMA"],
 ["robot","tank","land",5,"mobile",1,.68,"İnsansız kara aracı"],
 ["antitank","gun","land",2,"antiarmour",.5,1.05,"Tanksavar takımı|Motorlu tanksavar|Modern tanksavar|Dağıtık tanksavar"],
 ["defence","gun","air",3,"shield",1,1.25,"SAM / MANPADS desteği|Mobil hava savunma|Ağ destekli hava savunma"],
 ["strike","plane","air",2,"support",3,1.1,"Yakın hava destek uçağı|Jet taarruz uçağı"],
 ["bomber","plane","air",2,"air",4,1.45,"Bombardıman uçağı"],
 ["male","drone","uav",4,"air",1.5,1.45,"Erken silahlı MALE|Ağır MALE SİHA"],
 ["ucav","drone","uav",5,"air",2,2.1,"Jet UCAV"],
 ["swarm","drone","uav",5,"swarm",.5,.8,"Tek kullanımlık drone grubu"],
 ["boat","ship","navy",1,"escort",1,.55,"Torpidobot|Devriye botu|Füzeli hücumbot"],
 ["capital","ship","navy",1,"capital",6,2.5,"Dretnot|Ağır zırhlı gemi"],
 ["cruiser","ship","navy",1,"capital",5,1.8,"Zırhlı kruvazör|Ağır kruvazör"],
 ["battlecruiser","ship","navy",1,"capital",6,2.15,"Muharebe kruvazörü"],
 ["reconcar","tank","land",3,"mobile",1,.65,"Zırhlı keşif aracı|Modern zırhlı keşif aracı|Ağ destekli keşif aracı"],
 ["patrol","ship","navy",4,"escort",1,.7,"Açık deniz devriye gemisi|Modern devriye gemisi"],
 ["carrier","ship","navy",2,"capital",7,3,"Uçak gemisi|Jet uçak gemisi|Filo uçak gemisi|Modern uçak gemisi"],
 ["landing","ship","navy",2,"lift",3,1.3,"Çıkarma gemisi|Amfibi taşıma gemisi|Amfibi hücum gemisi|LHD / SİHA gemisi"],
 ["sub","ship","navy",2,"sub",2,1.1,"Denizaltı|Okyanus denizaltısı|Modern denizaltı|Yeni nesil denizaltı"],
 ["corvette","ship","navy",3,"escort",2,.8,"Füzeli korvet|Devriye korveti|Modern korvet"],
 ["surface","usv","usv",5,"escort",1,1.35,"Silahlı İDA"],
 ["antisub","usv","usv",5,"screen",1,1.55,"DSH İDA"],
 ["seaswarm","usv","usv",5,"swarm",.5,.8,"Tek kullanımlık İDA grubu"],
 ["ew","gun","industry",4,"electronic",1,1.4,"Elektronik harp desteği|Modern elektronik destek"]
];
export const models=Object.fromEntries(rows.map(([key,family,branch,first,role,fuel,scale,labels])=>
 [key,{family,branch,first,role,fuel,scale,labels:labels.split("|")}]));
// Local flavour denotes a representative platform, never its historical introduction date.
const examples={
 tr:{"rifle.1":"Kuvâ-yi Milliye","battlecruiser.1":"Yavuz","tank.5":"Altay","male.4":"Bayraktar TB2","male.5":"Akıncı","ucav.5":"Kızılelma · prototip","ship.5":"İstif sınıfı","landing.5":"TCG Anadolu","surface.5":"ULAQ"},
 gb:{"plane.2":"Spitfire"},fr:{"tank.1":"Renault FT"},ru:{"tank.2":"T-34"},gr:{"cruiser.1":"Georgios Averof"},
 c840:{"tank.2":"M4 Sherman","heavy.3":"M1 Abrams"},c276:{"tank.2":"Panzer IV"},c380:{"capital.2":"Littorio"},c392:{"carrier.2":"Akagi"},
 c156:{"tank.3":"Type 59"},c364:{"plane.3":"F-14"},c356:{"tank.3":"Vijayanta"},c410:{"tank.5":"K2"},
 c376:{"tank.3":"Merkava Mk 1"},c804:{"tank.4":"T-84"},c616:{"tank.4":"PT-91"},c076:{"reconcar.3":"EE-9 Cascavel"},
 c818:{"boat.3":"Ramadan sınıfı"},c724:{"ship.4":"Álvaro de Bazán sınıfı"},c586:{"tank.4":"Al-Khalid"},c682:{"plane.4":"F-15S"},
 c124:{"tank.2":"Ram"},c036:{"tank.2":"Sentinel"},c360:{"ship.5":"Martadinata sınıfı"},c484:{"patrol.4":"Oaxaca sınıfı"},
 c710:{"ifv.3":"Ratel"},c032:{"tank.3":"TAM"},c752:{"tank.3":"Strv 103"},c528:{"ship.4":"De Zeven Provinciën sınıfı"},c031:{"heavy.3":"T-72"}
};
export function modelName(key,level,owner){
 const m=models[key],label=m?.labels[level-m.first];
 const example=examples[owner]?.[key+"."+level];
 return (label||m?.labels.at(-1)||key)+(example?" · "+example:"");
}
