export interface PlaceLocation {
  label: string;
  sublabel?: string;
  lat: number;
  lng: number;
  category?: 'AIRPORTS' | 'MANGALURU' | 'OUTSTATION';
  keywords?: string[];
  source?: 'LOCAL' | 'OSM_LIVE';
}

export const ALL_LOCATIONS: PlaceLocation[] = [
  // Airports (Mangaluru & South India Major Gateways)
  {
    label: 'Mangaluru Airport (IXE)',
    sublabel: 'Bajpe Terminal, Mangaluru',
    lat: 12.9613,
    lng: 74.8901,
    category: 'AIRPORTS',
    keywords: ['bajpe', 'airport', 'ixe', 'flight', 'mangalore', 'mangaluru airport', 'aerodrome']
  },
  {
    label: 'Kempegowda Intl Airport (BLR)',
    sublabel: 'Devanahalli Airport, Bengaluru',
    lat: 13.1986,
    lng: 77.7066,
    category: 'AIRPORTS',
    keywords: ['bangalore', 'airport', 'blr', 'kempegowda', 'devanahalli', 'bengaluru airport']
  },
  {
    label: 'Kannur Intl Airport (CNN)',
    sublabel: 'Mattannur, Kannur, Kerala',
    lat: 11.9192,
    lng: 75.5482,
    category: 'AIRPORTS',
    keywords: ['kannur', 'airport', 'cnn', 'kerala', 'mattannur', 'kannur airport']
  },
  {
    label: 'Manohar Intl Airport, Mopa (GOX)',
    sublabel: 'Mopa, North Goa',
    lat: 15.7667,
    lng: 73.8667,
    category: 'AIRPORTS',
    keywords: ['goa', 'mopa', 'airport', 'gox', 'north goa', 'manohar']
  },
  {
    label: 'Goa Dabolim Airport (GOI)',
    sublabel: 'Dabolim, South Goa',
    lat: 15.3808,
    lng: 73.8314,
    category: 'AIRPORTS',
    keywords: ['goa', 'dabolim', 'airport', 'goi', 'south goa']
  },
  {
    label: 'Mysuru Airport (MYQ)',
    sublabel: 'Mandakalli, Mysuru',
    lat: 12.2289,
    lng: 76.6543,
    category: 'AIRPORTS',
    keywords: ['mysore', 'mysuru', 'airport', 'myq', 'mandakalli']
  },
  {
    label: 'Calicut Intl Airport (CCJ)',
    sublabel: 'Karipur, Kozhikode, Kerala',
    lat: 11.1367,
    lng: 75.9553,
    category: 'AIRPORTS',
    keywords: ['calicut', 'kozhikode', 'karipur', 'airport', 'ccj', 'kerala']
  },
  {
    label: 'Cochin Intl Airport (COK)',
    sublabel: 'Nedumbassery, Kochi, Kerala',
    lat: 10.1557,
    lng: 76.3916,
    category: 'AIRPORTS',
    keywords: ['cochin', 'kochi', 'nedumbassery', 'airport', 'cok', 'kerala']
  },
  {
    label: 'Hubballi Airport (HBX)',
    sublabel: 'Gokul Road, Hubballi',
    lat: 15.3617,
    lng: 75.0849,
    category: 'AIRPORTS',
    keywords: ['hubli', 'hubballi', 'airport', 'hbx']
  },
  {
    label: 'Belagavi Airport (IXG)',
    sublabel: 'Sambra, Belagavi',
    lat: 15.8593,
    lng: 74.6183,
    category: 'AIRPORTS',
    keywords: ['belgaum', 'belagavi', 'sambra', 'airport', 'ixg']
  },
  {
    label: 'Shivamogga Airport (RQY)',
    sublabel: 'Sogane, Shivamogga',
    lat: 13.8617,
    lng: 75.6328,
    category: 'AIRPORTS',
    keywords: ['shivamogga', 'shimoga', 'sogane', 'airport', 'rqy']
  },

  // Major Railway & Bus Terminals
  { label: 'Mangaluru Central Railway Station', sublabel: 'MAQ, Hampankatta', lat: 12.8634, lng: 74.8436, category: 'MANGALURU', keywords: ['train', 'station', 'railway', 'central', 'maq', 'hampankatta'] },
  { label: 'Mangaluru Junction Railway Station', sublabel: 'MAJN, Kankanady Bypass', lat: 12.8687, lng: 74.8624, category: 'MANGALURU', keywords: ['train', 'station', 'railway', 'junction', 'majn', 'kankanady', 'padil'] },
  { label: 'Surathkal Railway Station', sublabel: 'SL, NH66 Surathkal', lat: 13.0035, lng: 74.7960, category: 'MANGALURU', keywords: ['train', 'station', 'railway', 'surathkal', 'sl'] },
  { label: 'Udupi Railway Station', sublabel: 'UD, Indrali / Manipal Road', lat: 13.3480, lng: 74.7820, category: 'OUTSTATION', keywords: ['train', 'station', 'railway', 'udupi', 'indrali', 'ud'] },
  { label: 'Bejai KSRTC Terminal, Mangaluru', sublabel: 'Main Interstate Bus Stand, Bejai', lat: 12.8838, lng: 74.8474, category: 'MANGALURU', keywords: ['bus stand', 'ksrtc', 'bejai', 'interstate'] },
  { label: 'State Bank Bus Terminus, Mangaluru', sublabel: 'City & Service Bus Terminal, Hampankatta', lat: 12.8620, lng: 74.8390, category: 'MANGALURU', keywords: ['state bank', 'service bus stand', 'city bus stand', 'hampankatta'] },

  // Mangaluru Temples, Shrines & Cultural Landmarks
  { label: 'Shri Gopalakrishna Temple, Shakthinagar', sublabel: 'Shakthinagar / Kulshekar Area, Mangaluru', lat: 12.8935, lng: 74.8870, category: 'MANGALURU', keywords: ['shri gopalakrishna', 'gopalakrishna temple', 'gopalakrishna', 'temple', 'shakthinagar', 'shaktinagar'] },
  { label: 'Shri Krishna Dhyana Mandir, Mudipu', sublabel: 'Mudipu Bhajana Mandira Center, Mangaluru', lat: 12.7930, lng: 74.9540, category: 'MANGALURU', keywords: ['shri krishna', 'krishna dhyana mandir', 'dhyana mandir', 'dyana mandir', 'bhajana mandir', 'mandira', 'mudipu'] },
  { label: 'Kudroli Gokarnanatheshwara Temple', sublabel: 'Kudroli / Alake, Mangaluru', lat: 12.8800, lng: 74.8320, category: 'MANGALURU', keywords: ['kudroli', 'gokarnanatheshwara', 'temple', 'dasara', 'alake'] },
  { label: 'Mangaladevi Temple, Bolar', sublabel: 'Historic Origin Shrine of Mangaluru, Bolar', lat: 12.8485, lng: 74.8435, category: 'MANGALURU', keywords: ['mangaladevi', 'mangala devi', 'temple', 'bolar'] },
  { label: 'Kadri Manjunatha Temple', sublabel: 'Kadri Hills / Mallikatte, Mangaluru', lat: 12.8845, lng: 74.8570, category: 'MANGALURU', keywords: ['kadri', 'manjunatha', 'kadri temple', 'mallikatte'] },
  { label: 'Sharavu Mahaganapathi Temple', sublabel: 'Sharavu Ganapathi Temple, Hampankatta / KS Rao Rd', lat: 12.8715, lng: 74.8415, category: 'MANGALURU', keywords: ['sharavu', 'mahaganapathi', 'ganapathi temple', 'ks rao road'] },
  { label: 'Kateel Shri Durgaparameshwari Temple', sublabel: 'Nandini River Island Shrine, Kateel', lat: 13.0139, lng: 74.8519, category: 'MANGALURU', keywords: ['kateel', 'durgaparameshwari', 'temple'] },
  { label: 'Polali Shri Rajarajeshwari Temple', sublabel: 'Phalguni River Temple, Bantwal', lat: 12.9287, lng: 74.9573, category: 'MANGALURU', keywords: ['polali', 'rajarajeshwari', 'temple', 'bantwal'] },
  { label: 'Bappanadu Shri Durgaparameshwari Temple, Mulki', sublabel: 'Communal Harmony Shrine, Mulki NH66', lat: 13.0965, lng: 74.7940, category: 'MANGALURU', keywords: ['bappanadu', 'mulki', 'durgaparameshwari', 'temple'] },
  { label: 'Infant Jesus Shrine, Bikarnakatte', sublabel: 'Bikarnakatte / Kulshekar Road', lat: 12.8800, lng: 74.8690, category: 'MANGALURU', keywords: ['bikarnakatte', 'infant jesus', 'shrine', 'church'] },
  { label: 'Pilikula Nisargadhama, Vamanjoor', sublabel: 'Biological Zoo, Heritage Village & Golf Course', lat: 12.9280, lng: 74.9010, category: 'MANGALURU', keywords: ['pilikula', 'nisargadhama', 'zoo', 'park', 'vamanjoor'] },
  { label: 'St. Aloysius Chapel, Light House Hill', sublabel: 'Light House Hill Road, Mangaluru', lat: 12.8710, lng: 74.8460, category: 'MANGALURU', keywords: ['aloysius', 'chapel', 'light house hill'] },
  { label: 'Milagres Church, Hampankatta', sublabel: 'Falnir Road / Hampankatta', lat: 12.8680, lng: 74.8460, category: 'MANGALURU', keywords: ['milagres', 'church', 'hampankatta'] },
  { label: 'Rosario Cathedral, Bolar', sublabel: 'Bolar Church Road, Mangaluru', lat: 12.8550, lng: 74.8410, category: 'MANGALURU', keywords: ['rosario', 'cathedral', 'bolar'] },
  { label: 'Ullal Sayyid Madani Darga', sublabel: 'Historic Dargah, Ullal Coast', lat: 12.8050, lng: 74.8550, category: 'MANGALURU', keywords: ['ullal', 'darga', 'dargah', 'sayyid madani'] },
  { label: 'Sultan Battery & Watchtower, Boloor', sublabel: 'Gurupura River Ferry Point, Boloor', lat: 12.8890, lng: 74.8210, category: 'MANGALURU', keywords: ['sultan battery', 'boloor', 'watchtower'] },
  { label: 'Tannirbhavi Beach & Tree Park', sublabel: 'Tannirbhavi Coastal Park, Mangaluru', lat: 12.8970, lng: 74.8110, category: 'MANGALURU', keywords: ['tannirbhavi', 'beach', 'tree park'] },
  { label: 'Panambur Beach & NMPT Port', sublabel: 'Port Area & Beach, Mangaluru', lat: 12.9333, lng: 74.8055, category: 'MANGALURU', keywords: ['nmpt', 'port', 'beach', 'panambur'] },
  { label: 'Sasihithlu Beach & Surfing Spot', sublabel: 'Nandini & Shambhavi Confluence, Mukka', lat: 13.0640, lng: 74.7820, category: 'MANGALURU', keywords: ['sasihithlu', 'surfing', 'beach', 'mukka'] },
  { label: 'Someshwara Beach & Temple', sublabel: 'Rudra Shile / Ullal Coast', lat: 12.7840, lng: 74.8590, category: 'MANGALURU', keywords: ['someshwara', 'beach', 'rudra shile'] },

  // Hospitals & Colleges
  { label: 'Father Muller Hospital, Kankanady', sublabel: 'Father Muller Medical College, Pumpwell', lat: 12.8640, lng: 74.8580, category: 'MANGALURU', keywords: ['father muller', 'mullers', 'hospital', 'kankanady'] },
  { label: 'KMC Hospital, Ambedkar Circle (Jyothi)', sublabel: 'Dr. B.R. Ambedkar Circle / Balmatta Rd', lat: 12.8720, lng: 74.8480, category: 'MANGALURU', keywords: ['kmc', 'hospital', 'jyothi circle', 'ambedkar circle'] },
  { label: 'A.J. Hospital & Research Centre, Kuntikan', sublabel: 'Kuntikan NH66 Highway, Mangaluru', lat: 12.9010, lng: 74.8530, category: 'MANGALURU', keywords: ['aj hospital', 'kuntikan', 'hospital', 'medical'] },
  { label: 'Yenepoya Hospital & University, Deralakatte', sublabel: 'Medical & Dental Campus, Deralakatte', lat: 12.8210, lng: 74.8860, category: 'MANGALURU', keywords: ['yenepoya', 'deralakatte', 'hospital', 'university'] },
  { label: 'Nitte University / KSHEMA, Deralakatte', sublabel: 'Justice K.S. Hegde Charitable Hospital', lat: 12.8250, lng: 74.8890, category: 'MANGALURU', keywords: ['nitte', 'kshema', 'deralakatte', 'hospital'] },
  { label: 'Mangalore University Campus, Konaje', sublabel: 'Mangalagangothri University Campus, Konaje', lat: 12.8180, lng: 74.9280, category: 'MANGALURU', keywords: ['mangalore university', 'konaje', 'university', 'mangalagangothri'] },
  { label: 'St. Joseph Engineering College (SJEC), Vamanjoor', sublabel: 'SJEC Campus / Vamanjoor Junction', lat: 12.9180, lng: 74.8980, category: 'MANGALURU', keywords: ['sjec', 'vamanjoor', 'engineering', 'st joseph'] },
  { label: 'Sahyadri College of Engineering, Adyar', sublabel: 'NH75 Netravathi River Campus, Adyar', lat: 12.8670, lng: 74.9240, category: 'MANGALURU', keywords: ['sahyadri', 'adyar', 'engineering', 'nh75'] },
  { label: 'Canara Engineering College, Benjanapadavu', sublabel: 'Benjanapadavu / Bantwal', lat: 12.8990, lng: 74.9920, category: 'MANGALURU', keywords: ['canara', 'benjanapadavu', 'engineering'] },
  { label: 'PA College of Engineering (PACE), Nadupadavu', sublabel: 'PACE Campus, Nadupadavu / Mudipu', lat: 12.7980, lng: 74.9650, category: 'MANGALURU', keywords: ['pace', 'nadupadavu', 'mudipu', 'engineering'] },
  { label: 'Infosys SEZ Campus, Mudipu', sublabel: 'Kamblapadavu / Mudipu IT SEZ Campus', lat: 12.7910, lng: 74.9580, category: 'MANGALURU', keywords: ['infosys', 'mudipu', 'kamblapadavu', 'it park'] },
  { label: 'Infosys Kottara, Mangaluru', sublabel: 'Urwa Stores / Kottara Chowki Campus', lat: 12.9020, lng: 74.8320, category: 'MANGALURU', keywords: ['infosys', 'kottara', 'it park'] },

  // Malls & Shopping
  { label: 'City Centre Mall, K.S. Rao Road', sublabel: 'K.S. Rao Road / Hampankatta, Mangaluru', lat: 12.8725, lng: 74.8445, category: 'MANGALURU', keywords: ['city centre', 'mall', 'ks rao road'] },
  { label: 'Forum Fiza Mall, Pandeshwar', sublabel: 'Pandeshwar / Hoige Bazaar, Mangaluru', lat: 12.8590, lng: 74.8400, category: 'MANGALURU', keywords: ['forum fiza', 'forum mall', 'pandeshwar'] },
  { label: 'Bharat Mall, Lalbagh', sublabel: 'Lalbagh / Bejai Main Road, Mangaluru', lat: 12.8850, lng: 74.8410, category: 'MANGALURU', keywords: ['bharat mall', 'lalbagh', 'pvr'] },

  // Mangaluru Specific Localities & Cross Roads
  { label: 'Gujjara Kere (Tank), Bolar, Mangaluru', sublabel: 'Gujjara Kere Lake / Bolar Main Road', lat: 12.8520, lng: 74.8420, category: 'MANGALURU', keywords: ['gujjara kere', 'gujjarakere', 'tank', 'bolar', 'lake', 'mangalore'] },
  { label: 'Morgansgate Cross Rd, Mangaluru', sublabel: 'Morgan Gate / Jeppu Bolar Area', lat: 12.8480, lng: 74.8465, category: 'MANGALURU', keywords: ['morgansgate', 'morgan gate', 'morgans', 'jeppu', 'cross road', 'bolar'] },
  { label: 'Kapikad (Bejai), Mangaluru', sublabel: 'Bejai Main Rd / Kapikad Cross', lat: 12.8885, lng: 74.8420, category: 'MANGALURU', keywords: ['kapikad', 'bejai', 'kapikad cross'] },
  { label: 'Kapikad (Thokkottu), Mangaluru', sublabel: 'Thokkottu / Ullal Gateway', lat: 12.8105, lng: 74.8620, category: 'MANGALURU', keywords: ['kapikad', 'thokkottu', 'ullal'] },
  { label: 'Shakthinagar, Mangaluru', sublabel: 'Shakthinagar Main Road / Housing Board', lat: 12.8950, lng: 74.8850, category: 'MANGALURU', keywords: ['shakthinagar', 'shaktinagar', 'kulshekar'] },
  { label: 'Mudipu Junction / Market', sublabel: 'Mudipu Center, Kurnad & Konaje Gateway', lat: 12.7930, lng: 74.9540, category: 'MANGALURU', keywords: ['mudipu', 'mudipu junction', 'kurnad'] },
  { label: 'Hampankatta, Mangaluru', sublabel: 'City Commercial Center & Market', lat: 12.8698, lng: 74.8430, category: 'MANGALURU', keywords: ['center', 'city', 'market', 'hampankatta'] },
  { label: 'Kankanady (Pumpwell Circle)', sublabel: 'Father Muller / Pumpwell Bypass Circle', lat: 12.8687, lng: 74.8624, category: 'MANGALURU', keywords: ['pumpwell', 'kankanady', 'bypass', 'circle'] },
  { label: 'Nanthoor Circle, Mangaluru', sublabel: 'NH66 & NH75 Junction, Bikarnakatte Road', lat: 12.8760, lng: 74.8690, category: 'MANGALURU', keywords: ['nanthoor', 'nanthur', 'circle', 'nh66'] },
  { label: 'Kadri Hills / Park, Mangaluru', sublabel: 'Kadri Manjunatha Temple & Park Area', lat: 12.8824, lng: 74.8582, category: 'MANGALURU', keywords: ['kadri', 'temple', 'mallikatte', 'kadri hills'] },
  { label: 'Falnir Road / Highlands, Mangaluru', sublabel: 'Mother Theresa Rd / KMC Highlands', lat: 12.8660, lng: 74.8510, category: 'MANGALURU', keywords: ['falnir', 'highlands', 'kmc', 'bendoor'] },
  { label: 'Valencia / Gorigudda, Mangaluru', sublabel: 'Valencia Circle / St. Vincent Convent', lat: 12.8580, lng: 74.8560, category: 'MANGALURU', keywords: ['valencia', 'gorigudda', 'kankanady'] },
  { label: 'Jeppu Market / Bolar, Mangaluru', sublabel: 'Jeppu Seminary / Bolar Ferry Wharf', lat: 12.8520, lng: 74.8440, category: 'MANGALURU', keywords: ['jeppu', 'bolar', 'market', 'seminary'] },
  { label: 'Attavar / Babugudda, Mangaluru', sublabel: 'KMC Hospital Attavar / Station Road', lat: 12.8610, lng: 74.8490, category: 'MANGALURU', keywords: ['attavar', 'babugudda', 'kmc attavar'] },
  { label: 'Car Street, Mangaluru', sublabel: 'Sri Venkataramana Temple / Market', lat: 12.8730, lng: 74.8390, category: 'MANGALURU', keywords: ['car street', 'carstreet', 'temple', 'bunder'] },
  { label: 'Kodialbail / PVS Circle, Mangaluru', sublabel: 'PVS Junction / Navabharath Circle', lat: 12.8760, lng: 74.8450, category: 'MANGALURU', keywords: ['kodialbail', 'pvs', 'circle', 'navabharath'] },
  { label: 'Mannagudda / Gandhinagar, Mangaluru', sublabel: 'Urwa Gandhinagar / Mannagudda Rd', lat: 12.8810, lng: 74.8360, category: 'MANGALURU', keywords: ['mannagudda', 'gandhinagar', 'urwa'] },
  { label: 'Urwa Market / Canara High School', sublabel: 'Urwa Store / Marigudi Temple', lat: 12.8860, lng: 74.8350, category: 'MANGALURU', keywords: ['urwa', 'urwa market', 'urwa store'] },
  { label: 'Ladyhill Circle / Chilimbi, Mangaluru', sublabel: 'Lalbagh to Ladyhill NH66', lat: 12.8900, lng: 74.8330, category: 'MANGALURU', keywords: ['ladyhill', 'chilimbi', 'lalbagh'] },
  { label: 'Kottara Chowki, Mangaluru', sublabel: 'NH66 Flyover / Infosys Kottara', lat: 12.9020, lng: 74.8320, category: 'MANGALURU', keywords: ['kottara', 'kottara chowki', 'infosys'] },
  { label: 'Derebail / Konchady, Mangaluru', sublabel: 'Derebail Church / Konchady Cross', lat: 12.9050, lng: 74.8460, category: 'MANGALURU', keywords: ['derebail', 'konchady', 'church'] },
  { label: 'Kavoor / Bondel (Airport Rd)', sublabel: 'Kavoor Junction / Bondel Church', lat: 12.9234, lng: 74.8643, category: 'MANGALURU', keywords: ['kavoor', 'bondel', 'airport road'] },
  { label: 'Maryhill / Helipad, Mangaluru', sublabel: 'Airport Highway / Vikas PU College', lat: 12.9120, lng: 74.8600, category: 'MANGALURU', keywords: ['maryhill', 'helipad', 'vikas'] },
  { label: 'Yeyyadi / Industrial Estate, Mangaluru', sublabel: 'Yeyyadi Junction / Shakthinagar Road', lat: 12.8980, lng: 74.8680, category: 'MANGALURU', keywords: ['yeyyadi', 'industrial', 'shakthinagar'] },
  { label: 'Kulshekar / Cordel Church, Mangaluru', sublabel: 'Kaikanamba / Kulshekar Chowki', lat: 12.8920, lng: 74.8770, category: 'MANGALURU', keywords: ['kulshekar', 'cordel', 'kaikanamba'] },
  { label: 'Padil / Mahaveera Circle, Mangaluru', sublabel: 'DC Office Padil / NH75 Junction', lat: 12.8680, lng: 74.8870, category: 'MANGALURU', keywords: ['padil', 'mahaveera', 'dc office'] },
  { label: 'Vamanjoor Junction, Mangaluru', sublabel: 'Pilikutla / Kudupu Temple Gateway', lat: 12.9180, lng: 74.8980, category: 'MANGALURU', keywords: ['vamanjoor', 'kudupu', 'sjec'] },
  { label: 'Gurupura / Kaikamba Junction', sublabel: 'Gurupura River Bridge / NH169', lat: 12.9430, lng: 74.9350, category: 'MANGALURU', keywords: ['gurupura', 'kaikamba', 'nh169'] },
  { label: 'Surathkal, Mangaluru', sublabel: 'NITK / Express Highway NH66', lat: 13.0116, lng: 74.7943, category: 'MANGALURU', keywords: ['nitk', 'beach', 'surathkal', 'nh66'] },
  { label: 'Baikampady Industrial Area', sublabel: 'KIADB Industrial Estate NH66', lat: 12.9600, lng: 74.8010, category: 'MANGALURU', keywords: ['baikampady', 'industrial', 'nh66'] },
  { label: 'Mukka / Srinivas Hospital, Mangaluru', sublabel: 'NH66 Coastal Highway', lat: 13.0370, lng: 74.7920, category: 'MANGALURU', keywords: ['mukka', 'srinivas', 'hospital'] },
  { label: 'Mulki, Mangaluru', sublabel: 'Bappanadu Temple / Surfing Hub', lat: 13.0972, lng: 74.7937, category: 'MANGALURU', keywords: ['mulki', 'surf', 'bappanadu'] },
  { label: 'Ullala / Thokkottu, Mangaluru', sublabel: 'Ullal Darga / South Mangaluru', lat: 12.8028, lng: 74.8569, category: 'MANGALURU', keywords: ['ullal', 'thokkottu', 'south', 'darga'] },
  { label: 'Deralakatte Medical Hub', sublabel: 'KSHEMA / Yenepoya / Nitte Campus', lat: 12.8239, lng: 74.8872, category: 'MANGALURU', keywords: ['deralakatte', 'nitte', 'kshema', 'yenepoya', 'university'] },
  { label: 'Bantwal / B.C. Road', sublabel: 'NH75 Gateway to Bengaluru', lat: 12.8890, lng: 75.0345, category: 'MANGALURU', keywords: ['bc road', 'bantwal', 'nh75'] },
  { label: 'Moodbidri, Mangaluru', sublabel: 'Thousand Pillar Jain Temple / Alva\'s', lat: 13.0700, lng: 74.9950, category: 'MANGALURU', keywords: ['moodbidri', 'alvas', 'jain temple'] },

  // Outstation Destinations & Cities
  { label: 'Bengaluru (Bangalore)', sublabel: 'Majestic / Indiranagar / Koramangala / Whitefield', lat: 12.9716, lng: 77.5946, category: 'OUTSTATION', keywords: ['bangalore', 'bengaluru', 'whitefield', 'majestic', 'electronic city', 'koramangala', 'indiranagar'] },
  { label: 'Indiranagar 100 Feet Rd, Bangalore', sublabel: 'Indiranagar 100ft Road / CMH Road', lat: 12.9784, lng: 77.6408, category: 'OUTSTATION', keywords: ['indiranagar', 'bangalore', '100 feet'] },
  { label: 'Koramangala 5th Block, Bangalore', sublabel: 'Sony World Junction / Forum Mall', lat: 12.9352, lng: 77.6245, category: 'OUTSTATION', keywords: ['koramangala', 'bangalore'] },
  { label: 'Whitefield ITPL, Bangalore', sublabel: 'ITPL Main Road / Hope Farm Junction', lat: 12.9858, lng: 77.7314, category: 'OUTSTATION', keywords: ['whitefield', 'itpl', 'bangalore'] },
  { label: 'Majestic Bus Stand / Railway Station, Bangalore', sublabel: 'KSR City Station & BMTC Hub', lat: 12.9774, lng: 77.5713, category: 'OUTSTATION', keywords: ['majestic', 'station', 'bangalore'] },
  { label: 'Udupi Sri Krishna Matha', sublabel: 'Car Street, Sri Krishna Temple & Service Bus Stand', lat: 13.3409, lng: 74.7421, category: 'OUTSTATION', keywords: ['udupi', 'krishna matha', 'krishna temple', 'malpe', 'car street'] },
  { label: 'Malpe Beach & Sea Walk', sublabel: 'Malpe Port & St. Mary\'s Island Ferry, Udupi', lat: 13.3490, lng: 74.7040, category: 'OUTSTATION', keywords: ['malpe', 'sea walk', 'st marys', 'beach', 'udupi'] },
  { label: 'Manipal', sublabel: 'MAHE University & Tiger Circle', lat: 13.3525, lng: 74.7865, category: 'OUTSTATION', keywords: ['manipal', 'mahe', 'mit', 'kmc', 'tiger circle'] },
  { label: 'Karkala', sublabel: 'Gommateshwara Monolith & Anekere', lat: 13.2144, lng: 74.9961, category: 'OUTSTATION', keywords: ['karkala', 'gomateshwara'] },
  { label: 'Kundapura', sublabel: 'Kodi Beach / NH66 Coastal Highway', lat: 13.6288, lng: 74.6917, category: 'OUTSTATION', keywords: ['kundapura', 'kundapur', 'kodi beach'] },
  { label: 'Kollur Mookambika', sublabel: 'Mookambika Temple & Kodachadri Foothills', lat: 13.8653, lng: 74.8142, category: 'OUTSTATION', keywords: ['kollur', 'mookambika', 'kodachadri'] },
  { label: 'Puttur', sublabel: 'Mahalingeshwara Temple & Campco', lat: 12.7663, lng: 75.2036, category: 'OUTSTATION', keywords: ['puttur', 'campco', 'darbe'] },
  { label: 'Uppinangady Sangama', sublabel: 'Netravathi & Kumaradhara Confluence', lat: 12.8360, lng: 75.2890, category: 'OUTSTATION', keywords: ['uppinangady', 'sangama', 'kumaradhara'] },
  { label: 'Belthangady / Ujire', sublabel: 'Charmadi Ghat Gateway / SDM College', lat: 13.0030, lng: 75.3180, category: 'OUTSTATION', keywords: ['belthangady', 'ujire', 'charmadi', 'sdm'] },
  { label: 'Sulya / Sullia', sublabel: 'NH275 Sampaje Ghat Highway', lat: 12.5647, lng: 75.3888, category: 'OUTSTATION', keywords: ['sullia', 'sulya', 'sampaje'] },
  { label: 'Kasaragod, Kerala', sublabel: 'Bekal Fort & Town Center', lat: 12.5102, lng: 74.9852, category: 'OUTSTATION', keywords: ['kasaragod', 'kerala', 'bekal'] },
  { label: 'Madikeri / Coorg', sublabel: 'Raja Seat & Coffee County', lat: 12.4244, lng: 75.7382, category: 'OUTSTATION', keywords: ['coorg', 'madikeri', 'kushalnagar'] },
  { label: 'Mysuru (Mysore)', sublabel: 'Mysore Palace & Chamundi Hill', lat: 12.3051, lng: 76.6551, category: 'OUTSTATION', keywords: ['mysore', 'mysuru', 'chamundi'] },
  { label: 'Dharmasthala', sublabel: 'Manjunatha Swamy Temple', lat: 12.9463, lng: 75.3789, category: 'OUTSTATION', keywords: ['dharmasthala', 'manjunatha'] },
  { label: 'Kukke Subrahmanya', sublabel: 'Subrahmanya Temple Foothills', lat: 12.6631, lng: 75.6148, category: 'OUTSTATION', keywords: ['kukke', 'subrahmanya'] },
  { label: 'Sringeri', sublabel: 'Sharada Peetham & Tunga River', lat: 13.4194, lng: 75.2570, category: 'OUTSTATION', keywords: ['sringeri', 'sharada peetha'] },
  { label: 'Murudeshwar', sublabel: 'Giant Shiva Statue & Beach', lat: 14.0940, lng: 74.4899, category: 'OUTSTATION', keywords: ['murudeshwar', 'shiva', 'beach'] },
  { label: 'Gokarna', sublabel: 'Om Beach & Mahabaleshwar Temple', lat: 14.5479, lng: 74.3188, category: 'OUTSTATION', keywords: ['gokarna', 'om beach', 'kudle'] },
  { label: 'Horanadu', sublabel: 'Annapoorneshwari Temple, Western Ghats', lat: 13.2750, lng: 75.3420, category: 'OUTSTATION', keywords: ['horanadu', 'annapoorneshwari'] },
  { label: 'Chikkamagaluru', sublabel: 'Mullayanagiri Peak & Coffee Estates', lat: 13.3161, lng: 75.7720, category: 'OUTSTATION', keywords: ['chikmagalur', 'chikkamagaluru'] },
  { label: 'Hassan', sublabel: 'Belur & Halebidu Gateway', lat: 13.0072, lng: 76.1032, category: 'OUTSTATION', keywords: ['hassan', 'belur', 'halebidu'] },
  { label: 'Shivamogga', sublabel: 'Jog Falls & Malnad Gateway', lat: 13.9299, lng: 75.5681, category: 'OUTSTATION', keywords: ['shivamogga', 'shimoga', 'jog falls'] },
  { label: 'Hubballi / Dharwad', sublabel: 'North Karnataka Commercial Hub', lat: 15.3647, lng: 75.1240, category: 'OUTSTATION', keywords: ['hubli', 'hubballi', 'dharwad'] },
  { label: 'Belagavi (Belgaum)', sublabel: 'Belagavi Fort & Airport', lat: 15.8497, lng: 74.4977, category: 'OUTSTATION', keywords: ['belgaum', 'belagavi'] },
  { label: 'Karwar', sublabel: 'Rabindranath Tagore Beach / Port', lat: 14.8136, lng: 74.1297, category: 'OUTSTATION', keywords: ['karwar', 'beach', 'goa border'] },
  { label: 'Ooty Central, Nilgiris', sublabel: 'Botanical Gardens / Lake, Nilgiris', lat: 11.4102, lng: 76.6950, category: 'OUTSTATION', keywords: ['ooty', 'nilgiris', 'tamil nadu'] },
  { label: 'Tirupati Balaji Temple', sublabel: 'Tirumala Venkateswara Swamy Temple', lat: 13.6833, lng: 79.3472, category: 'OUTSTATION', keywords: ['tirupati', 'tirumala', 'balaji'] },
];

/**
 * Calculates estimated driving distance in kilometres between two coordinates using Haversine formula + road factor.
 */
export function calculateGeoDistanceKm(
  lat1?: number,
  lon1?: number,
  lat2?: number,
  lon2?: number
): number {
  if (
    typeof lat1 !== 'number' ||
    typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' ||
    typeof lon2 !== 'number' ||
    (lat1 === 0 && lon1 === 0) ||
    (lat2 === 0 && lon2 === 0)
  ) {
    return 100;
  }

  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straight = R * c;

  return Math.round(straight * 1.25 * 10) / 10;
}

/**
 * Checks whether the route between pickup, via stops, and drop is strictly within the same city / local distance (< 22 km).
 * If any location is OUTSTATION or any stop/leg distance is >= 22 km, or total journey >= 22 km,
 * it is NOT a local route and will never switch to local rental.
 */
export function isLocalDistanceRoute(
  pickup?: PlaceLocation | null,
  drop?: PlaceLocation | null,
  viaStops?: (PlaceLocation | null | undefined)[] | null
): boolean {
  if (!pickup || !drop) return false;

  // 1. If pickup or drop is marked as OUTSTATION, definitely not local
  if (pickup.category === 'OUTSTATION' || drop.category === 'OUTSTATION') {
    return false;
  }

  // 2. Direct distance between pickup and drop must be under 22 km
  const directDist = calculateGeoDistanceKm(pickup.lat, pickup.lng, drop.lat, drop.lng);
  if (directDist >= 22) {
    return false;
  }

  // 3. If there are via stops, verify EVERY via stop is local (< 22 km from pickup) and not OUTSTATION
  if (viaStops && viaStops.length > 0) {
    let totalKm = 0;
    let prev = pickup;

    for (const stop of viaStops) {
      if (!stop) continue;

      // If stop is marked as OUTSTATION (e.g. Kukke Subrahmanya, Dharmasthala, Udupi, etc.)
      if (stop.category === 'OUTSTATION') {
        return false;
      }

      // Check distance from pickup to this stop
      const distFromPickup = calculateGeoDistanceKm(pickup.lat, pickup.lng, stop.lat, stop.lng);
      if (distFromPickup >= 22) {
        return false;
      }

      // Check distance from previous point to this stop
      const legDist = calculateGeoDistanceKm(prev.lat, prev.lng, stop.lat, stop.lng);
      totalKm += legDist;
      prev = stop;
    }

    // Add final leg from last stop to drop
    totalKm += calculateGeoDistanceKm(prev.lat, prev.lng, drop.lat, drop.lng);

    // If total route distance with all stops is 22 km or more, not local
    if (totalKm >= 22) {
      return false;
    }
  }

  return true;
}

/**
 * Checks whether a given location is an airport.
 */
export function isAirportLocation(loc?: PlaceLocation | null): boolean {
  if (!loc) return false;
  if (loc.category === 'AIRPORTS') return true;
  const text = `${loc.label} ${loc.sublabel || ''} ${(loc.keywords || []).join(' ')}`.toLowerCase();
  return (
    text.includes('airport') ||
    text.includes('aerodrome') ||
    text.includes('(ixe)') ||
    text.includes('(blr)') ||
    text.includes('(cnn)') ||
    text.includes('(goi)') ||
    text.includes('(gox)') ||
    text.includes('(ccj)') ||
    text.includes('(cok)') ||
    text.includes('(myq)') ||
    text.includes('(hbx)') ||
    text.includes('(ixg)') ||
    text.includes('(rqy)')
  );
}

/**
 * Checks whether two locations are identical (matching name/label or identical coordinates).
 */
export function isSameLocation(
  loc1?: PlaceLocation | string | null,
  loc2?: PlaceLocation | string | null
): boolean {
  if (!loc1 || !loc2) return false;

  const getCleanLabel = (l: PlaceLocation | string): string => {
    const raw = typeof l === 'string' ? l : l.label || '';
    return raw
      .toLowerCase()
      .replace(/[(),.\-_/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const label1 = getCleanLabel(loc1);
  const label2 = getCleanLabel(loc2);

  if (label1 && label2 && label1 === label2) {
    return true;
  }

  // Also check if both have valid coordinates
  if (
    typeof loc1 === 'object' &&
    typeof loc2 === 'object' &&
    typeof loc1.lat === 'number' &&
    typeof loc1.lng === 'number' &&
    typeof loc2.lat === 'number' &&
    typeof loc2.lng === 'number' &&
    loc1.lat !== 0 &&
    loc2.lat !== 0
  ) {
    const distKm = calculateGeoDistanceKm(loc1.lat, loc1.lng, loc2.lat, loc2.lng);
    if (distKm <= 0.1) {
      return true;
    }
  }

  return false;
}



