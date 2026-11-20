const CHOICES=[
 {id:"drought",t:"Kuraklık",x:"Hasat zayıf geçti; köylüler yardım bekliyor.",a:[["Tahıl yardımı gönder","50 altın · +4 istikrar",{gold:-50,stab:4}],["Kendi çarelerine baksınlar","−5 istikrar",{stab:-5}]]},
 {id:"volunteers",t:"Gönüllü Birlikleri",x:"Kasabalardan gelen gönüllüler orduya katılmak istiyor.",a:[["Orduya kat","30 altın · +25 asker",{gold:-30,army:25}],["Atölyelere yönlendir","+40 insan gücü",{men:40}]]},
 {id:"merchants",t:"Tüccar Heyeti",x:"Yabancı tüccarlar gümrük ayrıcalığı istiyor.",a:[["Ayrıcalık tanı","+90 altın · −3 istikrar",{gold:90,stab:-3}],["Yerli esnafı koru","+3 istikrar",{stab:3}]]},
 {id:"engineer",t:"Genç Mühendis",x:"Bir mühendis cepheyi bağlayan telgraf ağı öneriyor.",a:[["Projeyi finanse et","80 altın · +1 teknoloji",{gold:-80,tech:1}],["Şimdilik reddet","Etkisi yok",{}]]},
 {id:"unrest",t:"Şehirlerde Huzursuzluk",x:"Ağır vergiler yüzünden meydanlarda gösteriler var.",a:[["Vergi affı ilan et","60 altın · +7 istikrar",{gold:-60,stab:7}],["Jandarmayı gönder","−10 asker · −2 istikrar",{army:-10,stab:-2}]]},
 {id:"refugees",t:"Göçmen Kafilesi",x:"Savaştan kaçan aileler sınıra ulaştı.",a:[["Kapıları aç","20 altın · +50 insan gücü",{gold:-20,men:50}],["Sınırı kapat","−2 istikrar",{stab:-2}]]},
 {id:"loan",t:"Dış Borç Teklifi",x:"Bir banka konsorsiyumu hızlı kredi öneriyor.",a:[["150 altın borç al","5 tur boyunca −35 altın/tur",{gold:150,debt:5}],["Reddet","+1 istikrar",{stab:1}]]},
 {id:"harvest",t:"Bereketli Hasat",x:"Ambarlar doldu; halk bayram havasında.",a:[["Ordunun erzakına ayır","+60 insan gücü",{men:60}],["Pazarda sat","+70 altın",{gold:70}]]},
 {id:"spy",t:"Yakalanan Casus",x:"Karargâhta yabancı bir casus yakalandı.",a:[["Sorgula","+1 teknoloji · −2 istikrar",{tech:1,stab:-2}],["Takas et","+50 altın",{gold:50}]]}
];

export { CHOICES };
