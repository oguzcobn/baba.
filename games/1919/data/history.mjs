// Month-resolution display uses the office holder at the end of each month.
const tr='https://www.tccb.gov.tr/cumhurbaskanlarimiz/',uk='https://www.gov.uk/government/history/past-prime-ministers';
const turkish=[['1923-10','1938-11','Mustafa Kemal Atatürk'],['1938-11','1950-05','İsmet İnönü'],['1950-05','1960-05','Celal Bayar'],['1961-10','1966-03','Cemal Gürsel'],['1966-03','1973-03','Cevdet Sunay'],['1973-04','1980-04','Fahri Korutürk'],['1982-11','1989-11','Kenan Evren'],['1989-11','1993-04','Turgut Özal'],['1993-05','2000-05','Süleyman Demirel'],['2000-05','2007-08','Ahmet Necdet Sezer'],['2007-08','2014-08','Abdullah Gül']];
const british=[['1919-01','1922-10','David Lloyd George'],['1940-05','1945-07','Winston Churchill'],['1945-07','1951-10','Clement Attlee'],['1951-10','1955-04','Winston Churchill'],['1979-05','1990-11','Margaret Thatcher'],['1990-11','1997-05','John Major'],['1997-05','2007-06','Tony Blair'],['2007-06','2010-05','Gordon Brown'],['2010-05','2016-07','David Cameron'],['2016-07','2019-07','Theresa May'],['2019-07','2022-09','Boris Johnson']];
export function historicalOffice(country,date){
 const rows=['tr','792'].includes(country)?turkish:['gb','826'].includes(country)?british:[];
 const key=date.year+'-'+String(date.month+1).padStart(2,'0'),row=rows.find(([a,b])=>key>=a&&key<b);
 return row?{name:row[2],office:rows===turkish?'Cumhurbaşkanı':'Başbakan',source:rows===turkish?tr:uk}:null;
}
