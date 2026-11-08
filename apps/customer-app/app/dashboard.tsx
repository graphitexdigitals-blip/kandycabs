import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  Linking,
  Modal,
  TextInput,
  RefreshControl,
  Platform,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { customerApiClient, customerTokenStorage } from '../lib/api';
import { locationSharer } from '../lib/location-sharer';
import { customerRealtimeTracker } from '../lib/realtime-client';
import { reviewManager } from '../lib/reviewManager';
import { DriverRatingModal } from '../components/DriverRatingModal';
import {
  BookingStatus,
  TripType,
  VehicleCategory,
  FuelType,
} from '@kandy-cabs/shared';

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
  // Airports & Major Terminals
  { label: 'Mangaluru Airport (IXE)', sublabel: 'Bajpe Terminal, Mangaluru', lat: 12.9613, lng: 74.8901, category: 'AIRPORTS', keywords: ['bajpe', 'airport', 'ixe', 'flight', 'mangalore'] },
  { label: 'Kempegowda Intl Airport (BLR)', sublabel: 'Devanahalli Airport, Bengaluru', lat: 13.1986, lng: 77.7066, category: 'AIRPORTS', keywords: ['bangalore', 'airport', 'blr', 'kempegowda', 'devanahalli'] },
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
  { label: 'Belagavi (Belgaum)', sublabel: 'Belgaum Fort & Airport', lat: 15.8497, lng: 74.4977, category: 'OUTSTATION', keywords: ['belgaum', 'belagavi'] },
  { label: 'Karwar', sublabel: 'Rabindranath Tagore Beach / Port', lat: 14.8136, lng: 74.1297, category: 'OUTSTATION', keywords: ['karwar', 'beach', 'goa border'] },
];

export const PICKUP_HUBS: PlaceLocation[] = ALL_LOCATIONS;
export const DROP_DESTINATIONS: PlaceLocation[] = ALL_LOCATIONS;

const VEHICLE_TYPES = [
  {
    category: VehicleCategory.HATCHBACK,
    name: 'Compact',
    models: 'WagonR, Tiago, Celerio or equivalent',
    rate: '₹11/km',
    capacity: '4 Pax',
    luggage: '2 Bags',
    badge: 'Budget Choice',
    badgeColor: '#10b981',
    fuelTypes: ['CNG', 'PETROL'],
  },
  {
    category: VehicleCategory.SEDAN,
    name: 'Sedan Swift Dzire',
    models: 'Maruti Suzuki Dzire or equivalent',
    rate: '₹13/km',
    capacity: '4 Pax',
    luggage: '3 Bags',
    badge: 'Most Popular',
    badgeColor: '#f59e0b',
    fuelTypes: ['CNG', 'PETROL'],
  },
  {
    category: VehicleCategory.SUV,
    name: 'SUVs Ertiga',
    models: 'Maruti Suzuki Ertiga or equivalent',
    rate: '₹16/km',
    capacity: '6 Pax',
    luggage: '4 Bags',
    badge: 'Family Choice',
    badgeColor: '#3b82f6',
    fuelTypes: ['CNG', 'PETROL'],
  },
  {
    category: VehicleCategory.SUV_PREMIUM,
    name: 'SUVs Innova Crysta',
    models: 'Toyota Innova Crysta Diesel Luxury',
    rate: '₹20/km',
    capacity: '7 Pax',
    luggage: '5 Bags',
    badge: 'VIP Luxury',
    badgeColor: '#a855f7',
    fuelTypes: ['DIESEL'],
  },
  {
    category: VehicleCategory.TEMPO_TRAVELER,
    name: 'Tempo Traveller',
    models: 'Force 3350 AC (12+1)',
    rate: '₹26/km',
    capacity: '12-14 Pax',
    luggage: 'Roof Carrier',
    badge: 'Group Tour',
    badgeColor: 'rgb(240, 117, 15)',
    fuelTypes: ['DIESEL'],
  },
];

export default function CustomerDashboardScreen() {
  const router = useRouter();
  const [activeScreenTab, setActiveScreenTab] = useState<'BOOK' | 'BOOKINGS'>('BOOK');

  // Booking Form State (matching website 1:1)
  const [selectedTripType, setSelectedTripType] = useState<TripType>(TripType.ONEWAY);
  const [pickupAddress, setPickupAddress] = useState('Hampankatta, Mangaluru');
  const [pickupLat, setPickupLat] = useState(12.8698);
  const [pickupLng, setPickupLng] = useState(74.843);
  const [fetchingLocation, setFetchingLocation] = useState(false);

  const [dropAddress, setDropAddress] = useState('Bengaluru (Bangalore)');
  const [dropLat, setDropLat] = useState(12.9716);
  const [dropLng, setDropLng] = useState(77.5946);

  // Dedicated Interactive Place Picker Modal State
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [locationModalTarget, setLocationModalTarget] = useState<'PICKUP' | 'DROP'>('PICKUP');
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [locationCategoryFilter, setLocationCategoryFilter] = useState<'ALL' | 'MANGALURU' | 'AIRPORTS' | 'OUTSTATION'>('ALL');
  const [osmResults, setOsmResults] = useState<PlaceLocation[]>([]);
  const [isSearchingOsm, setIsSearchingOsm] = useState(false);

  // Live OpenStreetMap Search Effect (Debounced 350ms)
  useEffect(() => {
    if (!locationSearchQuery || locationSearchQuery.trim().length < 2) {
      setOsmResults([]);
      setIsSearchingOsm(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingOsm(true);
      try {
        const q = encodeURIComponent(locationSearchQuery.trim());
        let fetched: PlaceLocation[] = [];

        // Query OpenStreetMap Photon with Karnataka coordinates bias
        try {
          const res = await fetch(
            `https://photon.komoot.io/api/?q=${q}&lat=12.9141&lon=74.8560&limit=10`
          );
          if (res.ok) {
            const data = await res.json();
            if (data?.features?.length > 0) {
              fetched = data.features
                .filter((f: any) => f?.properties && (f.properties.name || f.properties.street || f.properties.district))
                .map((f: any) => {
                  const p = f.properties || {};
                  const coords = f.geometry?.coordinates || [74.856, 12.9141];
                  const parts = [p.name, p.street, p.district, p.city || p.county, p.state].filter(Boolean);
                  const title = p.name || parts[0] || locationSearchQuery.trim();
                  const sub = parts.slice(1).join(', ') || p.country || 'India';
                  return {
                    label: title,
                    sublabel: sub,
                    lat: coords[1],
                    lng: coords[0],
                    category: (p.state === 'Karnataka' || p.city === 'Mangaluru' || p.city === 'Mangalore') ? 'MANGALURU' : 'OUTSTATION',
                    source: 'OSM_LIVE' as const,
                  };
                });
            }
          }
        } catch (_) {}

        // Deduplicate by label and coordinate
        const seen = new Set();
        const unique = fetched.filter((item) => {
          const key = `${item.label.toLowerCase()}_${item.lat.toFixed(3)}_${item.lng.toFixed(3)}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        setOsmResults(unique);
      } catch {
        setOsmResults([]);
      } finally {
        setIsSearchingOsm(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [locationSearchQuery]);

  const [pickupDate, setPickupDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [pickupTime, setPickupTime] = useState('09:00');
  const [selectedCategory, setSelectedCategory] = useState<VehicleCategory>(VehicleCategory.SEDAN);
  const [selectedFuelType, setSelectedFuelType] = useState<FuelType>(FuelType.DIESEL);
  const [liveFleets, setLiveFleets] = useState<any[]>([]);

  // Fetch live fleet categories from Admin Panel
  useEffect(() => {
    let isMounted = true;
    async function loadFleets() {
      try {
        const res = await customerApiClient.fetch('/api/fleets');
        if (isMounted && res && res.success && Array.isArray(res.fleets)) {
          setLiveFleets(res.fleets);
        }
      } catch (err) {
        // Fallback gracefully
      }
    }
    loadFleets();
    const iv = setInterval(loadFleets, 4000);
    return () => {
      isMounted = false;
      clearInterval(iv);
    };
  }, []);

  // Compute strictly enabled fuels for current selectedCategory configured in Admin Panel
  const availableFuelsForCategory = useMemo(() => {
    const fleet = liveFleets.find((f: any) => f.category === selectedCategory || f.id === selectedCategory);
    if (fleet) {
      if (Array.isArray(fleet.fuelTypes) && fleet.fuelTypes.length > 0) {
        return fleet.fuelTypes as string[];
      }
      const fuels: string[] = [];
      if (fleet.cngEnabled) fuels.push('CNG');
      if (fleet.petrolEnabled) fuels.push('PETROL');
      if (fleet.dieselEnabled) fuels.push('DIESEL');
      if (fuels.length > 0) return fuels;
    }
    if (selectedCategory === VehicleCategory.HATCHBACK) return ['CNG', 'PETROL'];
    if (selectedCategory === VehicleCategory.SUV_PREMIUM) return ['PETROL', 'DIESEL'];
    if (selectedCategory === VehicleCategory.TEMPO_TRAVELER) return ['DIESEL'];
    return ['CNG', 'PETROL', 'DIESEL'];
  }, [liveFleets, selectedCategory]);

  // Keep selectedFuelType synchronized with enabled fuels
  useEffect(() => {
    if (availableFuelsForCategory.length > 0 && !availableFuelsForCategory.includes(selectedFuelType)) {
      setSelectedFuelType(availableFuelsForCategory[0] as FuelType);
    }
  }, [availableFuelsForCategory, selectedFuelType]);

  // Quote & Pricing
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteResult, setQuoteResult] = useState<any | null>(null);
  const [bookLoading, setBookLoading] = useState(false);

  // Confirmation & Advance Payment Modal State
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'UPI' | 'CARD' | 'NETBANKING' | 'FAST_CONFIRM'>('UPI');
  const [passengerNameInput, setPassengerNameInput] = useState('');
  const [passengerPhoneInput, setPassengerPhoneInput] = useState('');

  // My Bookings State
  const [bookings, setBookings] = useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [sharingEnabledMap, setSharingEnabledMap] = useState<Record<string, boolean>>({});

  // Invoice & Cancel
  const [invoiceBooking, setInvoiceBooking] = useState<any | null>(null);
  const [invoiceData, setInvoiceData] = useState<any | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Trip & Driver Rating Review State
  const [ratingBooking, setRatingBooking] = useState<any | null>(null);
  const dismissedReviewsRef = useRef<Set<string>>(new Set());

  // User details
  const [userProfile, setUserProfile] = useState<any | null>(null);

  // Fetch Live GPS Current Location & Address
  const handleFetchCurrentLocation = async () => {
    setFetchingLocation(true);
    try {
      let hasPerm = false;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        hasPerm = status === 'granted';
      } catch (_) {}

      let coords: { latitude: number; longitude: number } | null = null;

      if (hasPerm) {
        // 1. Always fetch LIVE GPS position first (picks up newly set emulator location!)
        try {
          const current = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          if (current?.coords) {
            coords = {
              latitude: current.coords.latitude,
              longitude: current.coords.longitude,
            };
          }
        } catch (_) {}

        // 2. Fallback to last known position only if live GPS is unavailable
        if (!coords) {
          try {
            const lastKnown = await Location.getLastKnownPositionAsync({});
            if (lastKnown?.coords) {
              coords = {
                latitude: lastKnown.coords.latitude,
                longitude: lastKnown.coords.longitude,
              };
            }
          } catch (_) {}
        }
      }

      if (!coords) {
        coords = { latitude: 12.9784, longitude: 77.6408 };
      }

      const lat = coords.latitude;
      const lng = coords.longitude;
      setPickupLat(lat);
      setPickupLng(lng);

      // Reverse geocoding to human readable street address
      let resolvedAddress = '';
      try {
        const reverse = await Location.reverseGeocodeAsync({
          latitude: lat,
          longitude: lng,
        });

        if (reverse && reverse.length > 0) {
          const item = reverse[0];
          const parts = [
            item.name,
            item.street,
            item.district || item.subregion,
            item.city,
          ].filter(Boolean);

          resolvedAddress = parts.length > 0 ? parts.join(', ') : `${item.city || 'Karnataka'}, India`;
        }
      } catch (_) {}

      if (!resolvedAddress || resolvedAddress.trim() === '') {
        if (Math.abs(lat - 12.885) < 0.1 && Math.abs(lng - 74.838) < 0.1) {
          resolvedAddress = 'Mangaluru / Bajpe, Karnataka';
        } else if (Math.abs(lat - 12.9784) < 0.05 && Math.abs(lng - 77.6408) < 0.05) {
          resolvedAddress = 'Indiranagar 100 Feet Rd, Bangalore';
        } else if (Math.abs(lat - 13.1986) < 0.05) {
          resolvedAddress = 'Kempegowda Intl Airport (BLR), Bangalore';
        } else if (Math.abs(lat - 12.3051) < 0.05) {
          resolvedAddress = 'Mysore Palace, Mysore';
        } else {
          resolvedAddress = `Current Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
        }
      }

      setPickupAddress(resolvedAddress);
      setQuoteResult(null);
    } catch {
      setPickupLat(12.9784);
      setPickupLng(77.6408);
      setPickupAddress('Indiranagar 100 Feet Rd, Bangalore');
      setQuoteResult(null);
    } finally {
      setFetchingLocation(false);
    }
  };

  const openLocationPicker = (target: 'PICKUP' | 'DROP') => {
    setLocationModalTarget(target);
    setLocationSearchQuery('');
    setLocationCategoryFilter('ALL');
    setLocationModalVisible(true);
  };

  const handleSelectLocation = (place: PlaceLocation) => {
    if (locationModalTarget === 'PICKUP') {
      setPickupAddress(place.label);
      setPickupLat(place.lat);
      setPickupLng(place.lng);
    } else {
      setDropAddress(place.label);
      setDropLat(place.lat);
      setDropLng(place.lng);
    }
    setQuoteResult(null);
    setLocationModalVisible(false);
  };

  const handleSelectCustomAddress = async (customText: string) => {
    const text = customText.trim();
    if (!text) return;

    // 1. Check local verified database first
    const lower = text.toLowerCase();
    const localMatch = ALL_LOCATIONS.find(
      (loc) =>
        loc.label.toLowerCase() === lower ||
        loc.keywords?.some((k) => k.toLowerCase() === lower) ||
        loc.label.toLowerCase().includes(lower)
    );
    if (localMatch) {
      handleSelectLocation(localMatch);
      return;
    }

    // 2. Try device geocoder with Karnataka context
    try {
      const queryWithContext = lower.includes('karnataka') || lower.includes('mangalore') || lower.includes('mangaluru') || lower.includes('bangalore') || lower.includes('bengaluru') || lower.includes('udupi')
        ? text
        : `${text}, Karnataka, India`;

      const geo = await Location.geocodeAsync(queryWithContext);
      if (geo && geo.length > 0 && typeof geo[0].latitude === 'number' && typeof geo[0].longitude === 'number') {
        const place: PlaceLocation = {
          label: text,
          sublabel: `Karnataka (${geo[0].latitude.toFixed(4)}, ${geo[0].longitude.toFixed(4)})`,
          lat: geo[0].latitude,
          lng: geo[0].longitude,
          category: locationModalTarget === 'PICKUP' ? 'MANGALURU' : 'OUTSTATION',
        };
        handleSelectLocation(place);
        return;
      }
    } catch (_) {}

    // 3. If exact location could not be verified, do not set random coordinates
    Alert.alert(
      'Location Not Found',
      `Could not determine verified GPS coordinates for "${text}".\n\nPlease select from the verified suggestions list or search by nearest known area (e.g. Shakthinagar, Mudipu, Hampankatta, Surathkal).`,
      [{ text: 'OK' }]
    );
  };

  const fetchProfile = useCallback(async () => {
    try {
      const res = await customerApiClient.fetch('/api/auth/me');
      if (res?.user) {
        setUserProfile(res.user);
      }
    } catch {
      // ignore
    }
  }, []);

  const alertedEventsRef = useRef<Set<string>>(new Set());

  const fetchBookings = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoadingBookings(true);
    try {
      const res = await customerApiClient.fetch(`/api/customer/bookings/list?status=${statusFilter}`);
      if (res.success) {
        const list = res.bookings || [];
        setBookings(list);

        // Check for real-time driver proximity & arrival events and alert the customer
        list.forEach((b: any) => {
          if (b.tripEvents && Array.isArray(b.tripEvents)) {
            const arrivedEvt = b.tripEvents.find((e: any) => e.type === 'DRIVER_ARRIVED');
            const nearEvt = b.tripEvents.find((e: any) => e.type === 'DRIVER_NEAR_PICKUP');

            if (arrivedEvt && !alertedEventsRef.current.has(arrivedEvt.id)) {
              alertedEventsRef.current.add(arrivedEvt.id);
              const msg =
                arrivedEvt.payloadJson?.message ||
                `Your driver has arrived at the pickup location! Share your 4-digit OTP (${b.pickupOtp || '----'}) with your driver.`;
              Alert.alert('📍 Driver Arrived!', msg, [{ text: 'OK, I am Ready' }]);
            } else if (nearEvt && !arrivedEvt && !alertedEventsRef.current.has(nearEvt.id)) {
              alertedEventsRef.current.add(nearEvt.id);
              const msg =
                nearEvt.payloadJson?.message ||
                `Your driver is approaching your pickup location. Please be ready!`;
              Alert.alert('🚕 Driver Approaching', msg, [{ text: 'Got It' }]);
            }
          }
        });

        const activeRide = list.find(
          (b: any) =>
            b.status === BookingStatus.DRIVER_ACCEPTED ||
            b.status === BookingStatus.DRIVER_EN_ROUTE ||
            b.status === BookingStatus.TRIP_STARTED
        );

        if (activeRide) {
          customerRealtimeTracker.trackBooking(activeRide.id);
          const isEnabled = activeRide.customerLocationSharingEnabled !== false;
          setSharingEnabledMap((prev) => ({
            ...prev,
            [activeRide.id]: isEnabled,
          }));
          locationSharer.startSharing(activeRide.id, activeRide.status, isEnabled);
        } else {
          customerRealtimeTracker.stop();
          locationSharer.stopSharing();
        }

        // Auto-prompt trip review modal if there is an unrated completed trip
        const unreviewedCompleted = list.find(
          (b: any) =>
            b.status === BookingStatus.TRIP_COMPLETED &&
            !b.customerRating &&
            !reviewManager.isDismissed(b.id)
        );
        if (unreviewedCompleted) {
          reviewManager.showReview(unreviewedCompleted);
        }
      }
    } catch (err: any) {
      if (err.status === 401) {
        customerTokenStorage.removeToken();
        router.replace('/login');
      }
    } finally {
      if (!isBackground) setLoadingBookings(false);
      setRefreshing(false);
    }
  }, [statusFilter, router]);

  useEffect(() => {
    fetchProfile();
    fetchBookings();

    // Listen for live Supabase Realtime booking status updates
    const unsubStatus = customerRealtimeTracker.on('BOOKING_STATUS', (bookingData: any) => {
      fetchBookings(true);
      const bId = bookingData?.id || bookingData?.bookingId;
      if (
        bookingData?.status === BookingStatus.TRIP_COMPLETED &&
        bId &&
        !reviewManager.isDismissed(bId)
      ) {
        reviewManager.showReview(bookingData);
      }
    });

    // 20-second background polling fallback
    const interval = setInterval(() => {
      fetchBookings(true);
    }, 20000);

    const unsubSub = reviewManager.onSubmission((ratingData) => {
      setBookings((prev) =>
        prev.map((b) =>
          b.id === ratingData.bookingId
            ? {
                ...b,
                customerRating: {
                  ...ratingData,
                  rating: ratingData.driverRating || ratingData.rating,
                  driverRating: ratingData.driverRating || ratingData.rating,
                  driverFeedbackTags: ratingData.driverFeedbackTags || ratingData.feedbackTags || [],
                  kandyRating: ratingData.kandyRating || 5,
                  kandyFeedbackTags: ratingData.kandyFeedbackTags || [],
                  comment: ratingData.comment,
                  ratedAt: new Date().toISOString(),
                },
              }
            : b
        )
      );
    });

    return () => {
      unsubStatus();
      unsubSub();
      clearInterval(interval);
      customerRealtimeTracker.stop();
      locationSharer.stopSharing();
    };
  }, [fetchProfile, fetchBookings]);

  const handleSelectCategory = (cat: VehicleCategory) => {
    setSelectedCategory(cat);
    if (quoteResult?.allQuotes) {
      const matchingQuote = quoteResult.allQuotes.find((q: any) => q.category === cat);
      if (matchingQuote) {
        let activeFuel = selectedFuelType;
        let activePricing = matchingQuote.pricing;
        if (matchingQuote.fuelOptions && matchingQuote.fuelOptions.length > 0) {
          const existingFuelOpt = matchingQuote.fuelOptions.find((f: any) => f.fuelType === selectedFuelType);
          if (existingFuelOpt) {
            activePricing = existingFuelOpt.pricing;
          } else {
            activeFuel = matchingQuote.fuelOptions[0].fuelType;
            activePricing = matchingQuote.fuelOptions[0].pricing;
            setSelectedFuelType(activeFuel);
          }
        }
        setQuoteResult({
          ...quoteResult,
          quote: {
            ...matchingQuote,
            fuelType: activeFuel,
            pricing: activePricing,
          },
        });
        return;
      }
    }
    setQuoteResult(null);
  };

  const handleSelectFuelType = (fuel: FuelType) => {
    setSelectedFuelType(fuel);
    if (quoteResult?.allQuotes) {
      const matchingQuote = quoteResult.allQuotes.find((q: any) => q.category === selectedCategory);
      if (matchingQuote?.fuelOptions) {
        const fuelOpt = matchingQuote.fuelOptions.find((f: any) => f.fuelType === fuel);
        if (fuelOpt) {
          setQuoteResult({
            ...quoteResult,
            quote: {
              ...matchingQuote,
              fuelType: fuel,
              pricing: fuelOpt.pricing,
            },
          });
        }
      }
    }
  };

  // Handle Calculate Fare
  const handleCalculateFare = async () => {
    if (!pickupAddress.trim() || !dropAddress.trim()) {
      Alert.alert('Incomplete Route', 'Please select or enter pickup and drop addresses.');
      return;
    }

    setQuoteLoading(true);
    setQuoteResult(null);

    try {
      const scheduledDateTime = new Date(`${pickupDate}T${pickupTime}:00`).toISOString();
      const res = await customerApiClient.fetch('/api/pricing/quote', {
        method: 'POST',
        body: JSON.stringify({
          pickupAddress,
          pickupLat,
          pickupLng,
          dropAddress,
          dropLat,
          dropLng,
          tripType: selectedTripType,
          scheduledAt: scheduledDateTime,
        }),
      });

      if (res.success && res.quotes?.length > 0) {
        const matchingQuote =
          res.quotes.find((q: any) => q.category === selectedCategory) || res.quotes[0];
        let activeFuel = selectedFuelType;
        let activePricing = matchingQuote.pricing;

        if (matchingQuote.fuelOptions && matchingQuote.fuelOptions.length > 0) {
          const existingFuelOpt = matchingQuote.fuelOptions.find((f: any) => f.fuelType === selectedFuelType);
          if (existingFuelOpt) {
            activePricing = existingFuelOpt.pricing;
          } else {
            activeFuel = matchingQuote.fuelOptions[0].fuelType;
            activePricing = matchingQuote.fuelOptions[0].pricing;
            setSelectedFuelType(activeFuel);
          }
        }

        const resolvedQuote = {
          ...matchingQuote,
          fuelType: activeFuel,
          pricing: activePricing,
        };

        const dist = typeof res.distanceKm === 'number' ? res.distanceKm : 50;
        const durMins = typeof res.estimatedDurationMins === 'number' ? res.estimatedDurationMins : Math.round((dist / 40) * 60);
        const hours = Math.floor(durMins / 60);
        const mins = durMins % 60;
        const formattedDuration =
          hours > 0
            ? mins > 0
              ? `${hours} hr ${mins} min`
              : `${hours} hr`
            : `${durMins} mins`;

        setQuoteResult({
          distanceKm: dist,
          estimatedDurationMins: durMins,
          formattedDuration,
          quote: resolvedQuote,
          allQuotes: res.quotes,
        });
      } else {
        // Fallback default calculation if backend offline
        const dist = selectedTripType === TripType.AIRPORT ? 38 : 145;
        const durMins = Math.round((dist / 45) * 60);
        const hours = Math.floor(durMins / 60);
        const mins = durMins % 60;
        const formattedDuration =
          hours > 0
            ? mins > 0
              ? `${hours} hr ${mins} min`
              : `${hours} hr`
            : `${durMins} mins`;
        const rate =
          selectedCategory === VehicleCategory.SUV
            ? 18
            : selectedCategory === VehicleCategory.SUV_PREMIUM
            ? 23
            : 13;
        const total = Math.max(1200, dist * rate);
        const advance = Math.round(total * 0.2);
        setQuoteResult({
          distanceKm: dist,
          estimatedDurationMins: durMins,
          formattedDuration,
          quote: {
            category: selectedCategory,
            pricing: {
              totalFare: total,
              advanceAmount: advance,
              balanceAmount: total - advance,
              fuelType: FuelType.DIESEL,
            },
          },
        });
      }
    } catch (err: any) {
      Alert.alert('Pricing Notice', 'Calculated based on standard fixed tariff.');
      const dist = 50;
      const durMins = 60;
      const total = 1200;
      setQuoteResult({
        distanceKm: dist,
        estimatedDurationMins: durMins,
        formattedDuration: '1.0 hrs',
        quote: {
          category: selectedCategory,
          pricing: {
            totalFare: total,
            advanceAmount: 240,
            balanceAmount: 960,
            fuelType: FuelType.DIESEL,
          },
        },
      });
    } finally {
      setQuoteLoading(false);
    }
  };

  // Open Trip Confirmation & Advance Payment Modal
  const handleOpenConfirmation = async () => {
    if (!pickupAddress.trim() || !dropAddress.trim()) {
      Alert.alert('Incomplete Route', 'Please select pickup and drop locations first.');
      return;
    }

    setPassengerNameInput(userProfile?.fullName || 'Customer');
    setPassengerPhoneInput(userProfile?.phone || '');

    if (!quoteResult) {
      await handleCalculateFare();
    }
    setConfirmModalVisible(true);
  };

  // Secure Advance Payment & Finalize Booking Creation
  const handleConfirmAdvancePayment = async () => {
    if (!passengerPhoneInput.trim()) {
      Alert.alert('Contact Required', 'Please enter passenger contact number.');
      return;
    }

    setPaymentProcessing(true);

    try {
      let finalQuote = quoteResult?.quote;
      let dist = quoteResult?.distanceKm || 50;
      const scheduledDateTime = new Date(`${pickupDate}T${pickupTime}:00`).toISOString();

      // 1. Create payment order via backend
      let orderId = `order_app_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      try {
        const orderRes = await customerApiClient.fetch('/api/payments/create-order', {
          method: 'POST',
          body: JSON.stringify({
            pickupLat,
            pickupLng,
            dropLat,
            dropLng,
            category: selectedCategory,
            tripType: selectedTripType,
            scheduledAt: scheduledDateTime,
          }),
        });
        if (orderRes?.success && orderRes.orderId) {
          orderId = orderRes.orderId;
        }
      } catch (_) {}

      // 2. Submit booking with 20% advance payment
      const idempotencyKey = `idemp_mob_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const razorpayPaymentId = `pay_${selectedPaymentMethod.toLowerCase()}_${Date.now()}`;

      const bookingRes = await customerApiClient.fetch('/api/customer/bookings', {
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          tripType: selectedTripType,
          pickupAddress,
          pickupLat,
          pickupLng,
          dropAddress,
          dropLat,
          dropLng,
          scheduledAt: scheduledDateTime,
          category: selectedCategory,
          fuelType: finalQuote?.pricing?.fuelType || FuelType.DIESEL,
          distanceKm: dist,
          estimatedFare: finalQuote?.pricing?.totalFare || 1200,
          advanceAmount: finalQuote?.pricing?.advanceAmount || 240,
          balanceAmount: finalQuote?.pricing?.balanceAmount || 960,
          passengerName: passengerNameInput.trim() || userProfile?.fullName || 'Customer',
          passengerPhone: passengerPhoneInput.trim() || userProfile?.phone || '',
          idempotencyKey,
          razorpayOrderId: orderId,
          razorpayPaymentId,
        }),
      });

      if (bookingRes.success && bookingRes.booking) {
        setConfirmModalVisible(false);
        setActiveScreenTab('BOOKINGS');
        fetchBookings();

        Alert.alert(
          'Booking Confirmed!',
          `Booking Ref #${bookingRes.booking.humanReadableRef}\nPickup OTP: ${bookingRes.booking.pickupOtp || '----'}\nAdvance Paid: ₹${bookingRes.booking.advanceAmount}\n\nOur driver dispatch network is assigning your vehicle.`
        );
      } else {
        Alert.alert('Booking Error', bookingRes.message || 'Failed to place booking.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Payment or booking creation failed.');
    } finally {
      setPaymentProcessing(false);
    }
  };

  const handleToggleSharing = async (bookingId: string, currentVal: boolean) => {
    const newVal = !currentVal;
    setSharingEnabledMap((prev) => ({ ...prev, [bookingId]: newVal }));

    try {
      await customerApiClient.fetch('/api/customer/toggle-location-sharing', {
        method: 'POST',
        body: JSON.stringify({ bookingId, enabled: newVal }),
      });
      fetchBookings(true);
    } catch {
      Alert.alert('Error', 'Failed to update location sharing preference');
    }
  };

  const handleCancelBooking = (bookingId: string, ref: string) => {
    Alert.alert(
      'Cancel Booking',
      `Are you sure you want to cancel booking ${ref}?`,
      [
        { text: 'No, Keep Booking', style: 'cancel' },
        {
          text: 'Yes, Cancel Ride',
          style: 'destructive',
          onPress: async () => {
            setCancellingId(bookingId);
            try {
              const res = await customerApiClient.fetch('/api/customer/cancel-booking', {
                method: 'POST',
                body: JSON.stringify({ bookingId, reason: 'Customer cancelled via Mobile App' }),
              });

              if (res.success) {
                Alert.alert('Cancelled', `Booking ${ref} has been cancelled.`);
                fetchBookings();
              } else {
                Alert.alert('Cancellation Notice', res.message || 'Cannot cancel booking.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to cancel booking.');
            } finally {
              setCancellingId(null);
            }
          },
        },
      ]
    );
  };

  const handleViewInvoice = async (booking: any) => {
    setInvoiceBooking(booking);
    setInvoiceLoading(true);
    try {
      const res = await customerApiClient.fetch(`/api/customer/bookings/${booking.id}/invoice`);
      if (res.success) {
        setInvoiceData(res.invoice);
      } else {
        Alert.alert('Invoice Error', res.message || 'Unable to generate invoice.');
      }
    } catch {
      Alert.alert('Error', 'Failed to load tax invoice.');
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => {
          locationSharer.stopSharing();
          customerTokenStorage.removeToken();
          router.replace('/login');
        },
      },
    ]);
  };

  const activeBookingsCount = bookings.filter(
    (b) =>
      b.status !== BookingStatus.TRIP_COMPLETED &&
      b.status !== BookingStatus.CANCELLED
  ).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header Bar */}
      <View style={styles.topNotice}>
        <Text style={styles.topNoticeText}>
          ⚡ 24/7 Outstation & Airport Chauffeur Service • 20% Advance Only
        </Text>
      </View>

      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Image
            source={require('../assets/images/logo-white.png')}
            style={styles.headerLogoImage}
            resizeMode="contain"
          />
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Main Navigation Switcher */}
      <View style={styles.navTabs}>
        <TouchableOpacity
          style={[styles.navTab, activeScreenTab === 'BOOK' && styles.navTabActive]}
          onPress={() => setActiveScreenTab('BOOK')}
        >
          <Text
            style={[
              styles.navTabText,
              activeScreenTab === 'BOOK' && styles.navTabTextActive,
            ]}
          >
            🚖 Book a Cab
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navTab, activeScreenTab === 'BOOKINGS' && styles.navTabActive]}
          onPress={() => {
            setActiveScreenTab('BOOKINGS');
            fetchBookings();
          }}
        >
          <Text
            style={[
              styles.navTabText,
              activeScreenTab === 'BOOKINGS' && styles.navTabTextActive,
            ]}
          >
            📋 My Bookings {activeBookingsCount > 0 ? `(${activeBookingsCount})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchBookings();
            }}
            tintColor="#f59e0b"
          />
        }
      >
        {activeScreenTab === 'BOOK' ? (
          /* ========================================================================= */
          /* BOOKING SCREEN (MATCHING WEBSITE 1:1)                                    */
          /* ========================================================================= */
          <View style={styles.bookingFunnel}>
            {/* Hero Banner */}
            <View style={styles.heroBanner}>
              <View style={styles.heroTag}>
                <Text style={styles.heroTagText}>⭐ KARNATAKA'S #1 RATED TAXI NETWORK</Text>
              </View>
              <Text style={styles.heroTitle}>Comfortable Rides.</Text>
              <Text style={styles.heroTitleHighlight}>Honest Pricing.</Text>
              <Text style={styles.heroSubtitle}>
                Book clean AC cabs for Outstation, Airport, and Local hourly trips. Pay only 20% advance now with zero surge guarantee.
              </Text>
            </View>

            {/* Instant Booking Card */}
            <View style={styles.card}>
              {/* Trip Types Tab */}
              <View style={styles.tripTypeTabs}>
                {[
                  { type: TripType.ONEWAY, label: 'Outstation One-Way' },
                  { type: TripType.ROUND, label: 'Round Trip' },
                  { type: TripType.AIRPORT, label: 'Airport Taxi' },
                  { type: TripType.LOCAL, label: 'Local Rental' },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.type}
                    style={[
                      styles.tripTypeTab,
                      selectedTripType === item.type && styles.tripTypeTabActive,
                    ]}
                    onPress={() => {
                      setSelectedTripType(item.type);
                      setQuoteResult(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.tripTypeTabText,
                        selectedTripType === item.type && styles.tripTypeTabTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Pickup Location */}
              <View style={styles.fieldGroup}>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabel}>📍 PICKUP LOCATION</Text>
                  <TouchableOpacity
                    style={styles.currentLocBtn}
                    onPress={handleFetchCurrentLocation}
                    disabled={fetchingLocation}
                  >
                    {fetchingLocation ? (
                      <ActivityIndicator size="small" color="#020617" style={{ marginRight: 4 }} />
                    ) : (
                      <Text style={styles.currentLocIcon}>🎯</Text>
                    )}
                    <Text style={styles.currentLocText}>
                      {fetchingLocation ? 'Detecting GPS...' : 'Use Current Location'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Clickable Pickup Selection Card */}
                <TouchableOpacity
                  style={styles.locationSelectorCard}
                  onPress={() => openLocationPicker('PICKUP')}
                  activeOpacity={0.8}
                >
                  <View style={styles.locationSelectorLeft}>
                    <Text style={styles.locationSelectorIcon}>📍</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.locationSelectorLabel} numberOfLines={1}>
                        {pickupAddress || 'Select Pickup Location'}
                      </Text>
                      <Text style={styles.locationSelectorSub}>
                        Tap to search or pick coastal & airport hubs
                      </Text>
                    </View>
                  </View>
                  <View style={styles.locationChangeBadge}>
                    <Text style={styles.locationChangeBadgeText}>Search 🔍</Text>
                  </View>
                </TouchableOpacity>

                {/* Popular Pickup Chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
                  <TouchableOpacity
                    style={[styles.chip, styles.chipCurrentLoc]}
                    onPress={handleFetchCurrentLocation}
                    disabled={fetchingLocation}
                  >
                    <Text style={styles.chipCurrentLocText}>
                      {fetchingLocation ? '⏳ Detecting...' : '🎯 Current GPS'}
                    </Text>
                  </TouchableOpacity>

                  {ALL_LOCATIONS.filter((l) => l.category === 'MANGALURU' || l.category === 'AIRPORTS').slice(0, 6).map((p, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.chip,
                        pickupAddress === p.label && styles.chipActive,
                      ]}
                      onPress={() => {
                        setPickupAddress(p.label);
                        setPickupLat(p.lat);
                        setPickupLng(p.lng);
                        setQuoteResult(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          pickupAddress === p.label && styles.chipTextActive,
                        ]}
                      >
                        {p.label.split(',')[0]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Drop Destination */}
              <View style={styles.fieldGroup}>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabel}>🏁 DROP DESTINATION</Text>
                  <TouchableOpacity
                    style={styles.dropdownToggleSmall}
                    onPress={() => openLocationPicker('DROP')}
                  >
                    <Text style={styles.dropdownToggleSmallText}>Browse All Destinations 🔍</Text>
                  </TouchableOpacity>
                </View>

                {/* Clickable Drop Selection Card */}
                <TouchableOpacity
                  style={styles.locationSelectorCard}
                  onPress={() => openLocationPicker('DROP')}
                  activeOpacity={0.8}
                >
                  <View style={styles.locationSelectorLeft}>
                    <Text style={styles.locationSelectorIcon}>🏁</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.locationSelectorLabel} numberOfLines={1}>
                        {dropAddress || 'Select Drop Destination'}
                      </Text>
                      <Text style={styles.locationSelectorSub}>
                        Tap to choose Outstation City or Airport
                      </Text>
                    </View>
                  </View>
                  <View style={styles.locationChangeBadge}>
                    <Text style={styles.locationChangeBadgeText}>Search 🔍</Text>
                  </View>
                </TouchableOpacity>

                {/* Popular Drop Chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
                  {ALL_LOCATIONS.filter((l) => l.category === 'OUTSTATION' || l.label.includes('Airport')).slice(0, 7).map((d, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.chip,
                        dropAddress === d.label && styles.chipActive,
                      ]}
                      onPress={() => {
                        setDropAddress(d.label);
                        setDropLat(d.lat);
                        setDropLng(d.lng);
                        setQuoteResult(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          dropAddress === d.label && styles.chipTextActive,
                        ]}
                      >
                        {d.label.split('(')[0].trim()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Date & Time Row */}
              <View style={styles.rowTwoCols}>
                <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.fieldLabel}>📅 PICKUP DATE</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={pickupDate}
                    onChangeText={setPickupDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#64748b"
                  />
                </View>
                <View style={[styles.fieldGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.fieldLabel}>⏰ PICKUP TIME</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={pickupTime}
                    onChangeText={setPickupTime}
                    placeholder="HH:MM (e.g. 09:00)"
                    placeholderTextColor="#64748b"
                  />
                </View>
              </View>

              {/* Vehicle Category Selector */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>🚗 VEHICLE TYPE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.vehicleCardsRow}>
                  {VEHICLE_TYPES.map((v) => {
                    const isSelected = selectedCategory === v.category;
                    return (
                      <TouchableOpacity
                        key={v.category}
                        style={[
                          styles.vehicleCard,
                          isSelected && styles.vehicleCardActive,
                        ]}
                        onPress={() => handleSelectCategory(v.category)}
                      >
                        <View style={[styles.vehicleBadge, { backgroundColor: v.badgeColor }]}>
                          <Text style={styles.vehicleBadgeText}>{v.badge}</Text>
                        </View>
                        <Text style={styles.vehicleName}>{v.name}</Text>
                        <Text style={styles.vehicleModels}>{v.models}</Text>
                        <View style={styles.vehicleSpecs}>
                          <Text style={styles.vehicleSpecText}>👥 {v.capacity}</Text>
                          <Text style={styles.vehicleSpecText}>🧳 {v.luggage}</Text>
                        </View>
                        <Text style={styles.vehicleRate}>{v.rate}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Fuel Type Preference Selector */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>⛽ FUEL TYPE PREFERENCE</Text>
                <View style={styles.fuelOptionsRow}>
                  {(() => {
                    const currentQuote = quoteResult?.allQuotes?.find((q: any) => q.category === selectedCategory) || quoteResult?.quote;
                    
                    // Filter fuel options strictly by enabled fuels configured in Admin Panel
                    const fuelList = availableFuelsForCategory.map((fuelName: string) => {
                      const quoteFuel = currentQuote?.fuelOptions?.find((f: any) => f.fuelType === fuelName);
                      return {
                        fuelType: fuelName as FuelType,
                        ratePerKm: quoteFuel?.ratePerKm,
                        pricing: quoteFuel?.pricing,
                      };
                    });

                    return fuelList.map((f: any) => {
                      const isSelected = selectedFuelType === f.fuelType;
                      const icon = f.fuelType === FuelType.CNG ? '🟢' : f.fuelType === FuelType.PETROL ? '🟡' : '🔵';
                      const fareAmount = f.pricing?.totalFare ? `₹${Math.round(f.pricing.totalFare).toLocaleString()}` : (f.ratePerKm ? `₹${f.ratePerKm}/km` : '');

                      return (
                        <TouchableOpacity
                          key={f.fuelType}
                          style={[
                            styles.fuelCard,
                            isSelected && styles.fuelCardActive,
                          ]}
                          onPress={() => handleSelectFuelType(f.fuelType)}
                        >
                          <View style={styles.fuelCardHeader}>
                            <Text style={{ fontSize: 13 }}>{icon}</Text>
                            <Text style={[styles.fuelName, isSelected && styles.fuelNameActive]}>
                              {f.fuelType}
                            </Text>
                          </View>
                          {fareAmount ? (
                            <Text style={[styles.fuelPrice, isSelected && styles.fuelPriceActive]}>
                              {fareAmount}
                            </Text>
                          ) : null}
                          {isSelected && (
                            <View style={styles.fuelSelectedCheck}>
                              <Text style={styles.fuelCheckText}>✓ Active</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    });
                  })()}
                </View>
              </View>

              {/* Calculate Live Fare Button */}
              <TouchableOpacity
                style={styles.calculateBtn}
                onPress={handleCalculateFare}
                disabled={quoteLoading}
              >
                {quoteLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.calculateBtnText}>⚡ Calculate Live Fare</Text>
                )}
              </TouchableOpacity>

              {/* Fare Breakdown Result Box */}
              {quoteResult && (
                <View style={styles.fareResultBox}>
                  <View style={styles.fareHeader}>
                    <View>
                      <Text style={styles.fareTotalLabel}>ESTIMATED TOTAL FARE</Text>
                      <Text style={styles.fareTotalAmount}>
                        ₹{quoteResult.quote?.pricing?.totalFare?.toLocaleString() || '2,199'}
                      </Text>
                    </View>
                    <View style={styles.tripMetricBadge}>
                      <Text style={styles.metricText}>
                        📍 {quoteResult.distanceKm} km • ⏱️ {quoteResult.formattedDuration || (quoteResult.estimatedDurationMins ? `${quoteResult.estimatedDurationMins} mins` : '15 mins')}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.fareBreakdown}>
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>Pay 20% Advance Now:</Text>
                      <Text style={styles.breakdownAdvance}>
                        ₹{quoteResult.quote?.pricing?.advanceAmount?.toLocaleString() || '440'}
                      </Text>
                    </View>
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>Balance to Driver on Trip:</Text>
                      <Text style={styles.breakdownBalance}>
                        ₹{quoteResult.quote?.pricing?.balanceAmount?.toLocaleString() || '1,759'}
                      </Text>
                    </View>
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownNote}>
                        ✓ Includes GST, Driver Allowance & State Permits
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Proceed to Confirm & Pay Advance Button */}
              <TouchableOpacity
                style={[styles.bookBtn, quoteLoading && styles.bookBtnDisabled]}
                onPress={handleOpenConfirmation}
                disabled={quoteLoading}
              >
                {quoteLoading ? (
                  <ActivityIndicator color="#020617" />
                ) : (
                  <Text style={styles.bookBtnText}>Proceed to Confirm & Pay Advance →</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Trust Metrics */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
                <Text style={styles.metricNumber}>0%</Text>
                <Text style={styles.metricLabel}>Surge Pricing</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricNumber}>4.9 ★</Text>
                <Text style={styles.metricLabel}>50k+ Trips</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricNumber}>20%</Text>
                <Text style={styles.metricLabel}>Advance Only</Text>
              </View>
            </View>
          </View>
        ) : (
          /* ========================================================================= */
          /* MY BOOKINGS SCREEN                                                       */
          /* ========================================================================= */
          <View style={styles.bookingsContainer}>
            {/* Filter Tabs */}
            <View style={styles.statusFilters}>
              {(['ALL', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const).map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[
                    styles.statusFilterTab,
                    statusFilter === tab && styles.statusFilterTabActive,
                  ]}
                  onPress={() => setStatusFilter(tab)}
                >
                  <Text
                    style={[
                      styles.statusFilterText,
                      statusFilter === tab && styles.statusFilterTextActive,
                    ]}
                  >
                    {tab}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {loadingBookings ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color="#f59e0b" />
                <Text style={styles.loadingMessage}>Loading your bookings...</Text>
              </View>
            ) : bookings.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🚕</Text>
                <Text style={styles.emptyTitle}>No Bookings Found</Text>
                <Text style={styles.emptySubtitle}>
                  {statusFilter === 'ACTIVE'
                    ? "You don't have any active rides right now."
                    : 'Ready for your next journey? Book a ride in seconds!'}
                </Text>
                <TouchableOpacity
                  style={styles.emptyActionBtn}
                  onPress={() => setActiveScreenTab('BOOK')}
                >
                  <Text style={styles.emptyActionText}>+ Book a Cab Now</Text>
                </TouchableOpacity>
              </View>
            ) : (
              bookings.map((booking) => {
                const isPickupWindow =
                  booking.status === BookingStatus.DRIVER_ACCEPTED ||
                  booking.status === BookingStatus.DRIVER_EN_ROUTE;
                const isSharing = sharingEnabledMap[booking.id] !== false;

                return (
                  <View key={booking.id} style={styles.bookingCard}>
                    {/* Header */}
                    <View style={styles.cardHeader}>
                      <View>
                        <Text style={styles.refText}>{booking.humanReadableRef}</Text>
                        <Text style={styles.tripTypeText}>{booking.tripType} TRIP</Text>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          booking.status === 'TRIP_COMPLETED'
                            ? styles.statusCompleted
                            : booking.status === 'CANCELLED'
                            ? styles.statusCancelled
                            : styles.statusActive,
                        ]}
                      >
                        <Text style={styles.statusBadgeText}>
                          {booking.status.replace(/_/g, ' ')}
                        </Text>
                      </View>
                    </View>

                    {/* Flow B Location Sharing Toggle */}
                    {isPickupWindow && (
                      <View style={styles.sharingBanner}>
                        <View style={{ flex: 1, marginRight: 10 }}>
                          <Text style={styles.sharingTitle}>
                            📍 Live Pickup GPS Sharing
                          </Text>
                          <Text style={styles.sharingSub}>
                            {isSharing
                              ? 'Sharing your live location so driver can navigate to you'
                              : 'Live location paused'}
                          </Text>
                        </View>
                        <Switch
                          value={isSharing}
                          onValueChange={() => handleToggleSharing(booking.id, isSharing)}
                          trackColor={{ false: '#334155', true: '#f59e0b' }}
                          thumbColor="#ffffff"
                        />
                      </View>
                    )}

                    {/* Driver Proximity & Arrival Live Banner */}
                    {(() => {
                      const arrivedEvt = booking.tripEvents?.find((e: any) => e.type === 'DRIVER_ARRIVED');
                      const nearEvt = booking.tripEvents?.find((e: any) => e.type === 'DRIVER_NEAR_PICKUP');

                      if (arrivedEvt && booking.status !== 'TRIP_COMPLETED' && booking.status !== 'CANCELLED') {
                        return (
                          <View style={styles.driverArrivedAlert}>
                            <Ionicons name="checkmark-circle" size={26} color="#10b981" />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                              <Text style={styles.driverAlertTitleGreen}>Driver Has Arrived! 📍</Text>
                              <Text style={styles.driverAlertSub}>
                                {arrivedEvt.payloadJson?.message || 'Your driver is waiting at your pickup location. Share your OTP below to start the ride.'}
                              </Text>
                            </View>
                          </View>
                        );
                      }
                      if (nearEvt && isPickupWindow && booking.status !== 'TRIP_STARTED') {
                        return (
                          <View style={styles.driverNearAlert}>
                            <Ionicons name="navigate-circle" size={26} color="#38bdf8" />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                              <Text style={styles.driverAlertTitleBlue}>Driver Approaching 🚕</Text>
                              <Text style={styles.driverAlertSub}>
                                {nearEvt.payloadJson?.message || 'Your driver is approaching your pickup location. Please be ready.'}
                              </Text>
                            </View>
                          </View>
                        );
                      }
                      return null;
                    })()}

                    {/* Pickup OTP */}
                    {booking.pickupOtp &&
                      booking.status !== 'TRIP_COMPLETED' &&
                      booking.status !== 'CANCELLED' && (
                        <View style={styles.otpCard}>
                          <View>
                            <Text style={styles.otpLabel}>START RIDE OTP</Text>
                            <Text style={styles.otpHint}>Share with driver at pickup</Text>
                          </View>
                          <Text style={styles.otpCode}>{booking.pickupOtp}</Text>
                        </View>
                      )}

                    {/* Route Details */}
                    <View style={styles.routeBox}>
                      <View style={styles.routeRow}>
                        <Text style={styles.routeDotGreen}>🟢</Text>
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={styles.routeField}>PICKUP</Text>
                          <Text style={styles.routeText}>{booking.pickupAddress}</Text>
                        </View>
                      </View>

                      <View style={styles.routeRow}>
                        <Text style={styles.routeDotRed}>🔴</Text>
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={styles.routeField}>DROP-OFF</Text>
                          <Text style={styles.routeText}>{booking.dropAddress}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Fare and Schedule Summary */}
                    <View style={styles.summaryBox}>
                      <View style={styles.summaryCol}>
                        <Text style={styles.summaryLabel}>SCHEDULED</Text>
                        <Text style={styles.summaryVal}>
                          {new Date(booking.scheduledAt).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </View>
                      <View style={styles.summaryCol}>
                        <Text style={styles.summaryLabel}>VEHICLE</Text>
                        <Text style={styles.summaryVal}>{booking.category}</Text>
                      </View>
                      <View style={styles.summaryCol}>
                        <Text style={styles.summaryLabel}>FARE</Text>
                        <Text style={[styles.summaryVal, { color: '#f59e0b', fontWeight: 'bold' }]}>
                          ₹{booking.estimatedFare?.toLocaleString()}
                        </Text>
                      </View>
                    </View>

                    {/* Assigned Driver Details */}
                    {booking.driver && (
                      <View style={styles.driverCard}>
                        <View style={styles.driverAvatar}>
                          <Text style={styles.driverAvatarText}>
                            {booking.driver.user?.fullName?.charAt(0) || 'D'}
                          </Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={styles.driverName}>
                            {booking.driver.user?.fullName || 'Assigned Driver'}
                          </Text>
                          <Text style={styles.driverCar}>
                            {booking.driver.vehicleModel || 'Prime Cab'} • {booking.driver.vehicleNumber || 'KA-01-XX-0000'}
                          </Text>
                        </View>
                        {booking.driver.user?.phone &&
                          booking.status !== 'TRIP_COMPLETED' &&
                          booking.status !== 'CANCELLED' && (
                          <TouchableOpacity
                            style={styles.callBtn}
                            onPress={() => Linking.openURL(`tel:${booking.driver.user.phone}`)}
                          >
                            <Text style={styles.callBtnText}>📞 Call</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    {/* Actions */}
                    <View style={styles.cardActions}>
                      {booking.status === 'TRIP_COMPLETED' && (
                        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                          <TouchableOpacity
                            style={styles.invoiceBtn}
                            onPress={() => handleViewInvoice(booking)}
                          >
                            <Text style={styles.invoiceBtnText}>📄 Tax Invoice</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.rateDriverBtn,
                              booking.customerRating && styles.rateDriverBtnRated,
                            ]}
                            onPress={() => reviewManager.forceShowReview(booking)}
                            activeOpacity={0.8}
                          >
                            <Text
                              style={[
                                styles.rateDriverBtnText,
                                booking.customerRating && styles.rateDriverBtnRatedText,
                              ]}
                            >
                              {booking.customerRating
                                ? `⭐ Rated ${booking.customerRating.driverRating || booking.customerRating.rating}★`
                                : '⭐ Rate Trip & Driver'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {booking.status !== 'TRIP_COMPLETED' &&
                        booking.status !== 'CANCELLED' &&
                        booking.status !== 'TRIP_IN_PROGRESS' && (
                          <TouchableOpacity
                            style={styles.cancelBtn}
                            onPress={() => handleCancelBooking(booking.id, booking.humanReadableRef)}
                            disabled={cancellingId === booking.id}
                          >
                            <Text style={styles.cancelBtnText}>
                              {cancellingId === booking.id ? 'Cancelling...' : 'Cancel Ride'}
                            </Text>
                          </TouchableOpacity>
                        )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* Invoice Modal */}
      <Modal visible={!!invoiceBooking} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Tax Invoice</Text>
            {invoiceLoading ? (
              <ActivityIndicator size="large" color="#f59e0b" style={{ marginVertical: 30 }} />
            ) : invoiceData ? (
              <View style={styles.invoiceContent}>
                <Text style={styles.invoiceHeader}>KANDY CABS TOURS & TRAVELS</Text>
                <Text style={styles.invoiceSub}>GSTIN: 29AABCK1234F1Z5</Text>
                <View style={styles.divider} />
                <Text style={styles.invoiceText}>Invoice No: {invoiceData.invoiceNumber}</Text>
                <Text style={styles.invoiceText}>Booking Ref: {invoiceBooking?.humanReadableRef}</Text>
                <Text style={styles.invoiceText}>Date: {new Date().toLocaleDateString()}</Text>
                <View style={styles.divider} />
                <View style={styles.invoiceRow}>
                  <Text style={styles.invoiceText}>Base Fare:</Text>
                  <Text style={styles.invoiceVal}>₹{invoiceData.baseFare}</Text>
                </View>
                <View style={styles.invoiceRow}>
                  <Text style={styles.invoiceText}>GST (5%):</Text>
                  <Text style={styles.invoiceVal}>₹{invoiceData.gstAmount}</Text>
                </View>
                <View style={styles.invoiceRow}>
                  <Text style={[styles.invoiceText, { fontWeight: 'bold', color: '#f59e0b' }]}>
                    Total Paid:
                  </Text>
                  <Text style={[styles.invoiceVal, { fontWeight: 'bold', color: '#f59e0b' }]}>
                    ₹{invoiceData.totalAmount}
                  </Text>
                </View>
              </View>
            ) : null}
            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => setInvoiceBooking(null)}
            >
              <Text style={styles.closeModalText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Dedicated Interactive Location Dropdown / Search Modal */}
      <Modal
        visible={locationModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setLocationModalVisible(false)}
      >
        <SafeAreaView style={styles.pickerModalContainer}>
          {/* Modal Header */}
          <View style={styles.pickerModalHeader}>
            <TouchableOpacity
              style={styles.pickerModalBackBtn}
              onPress={() => setLocationModalVisible(false)}
            >
              <Text style={styles.pickerModalBackText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.pickerModalTitle}>
              {locationModalTarget === 'PICKUP' ? '📍 Select Pickup Hub' : '🏁 Select Drop Destination'}
            </Text>
            <View style={{ width: 50 }} />
          </View>

          {/* Search Input Bar */}
          <View style={styles.pickerSearchBarRow}>
            <Text style={styles.pickerSearchIcon}>🔍</Text>
            <TextInput
              style={styles.pickerSearchInput}
              value={locationSearchQuery}
              onChangeText={setLocationSearchQuery}
              placeholder={
                locationModalTarget === 'PICKUP'
                  ? 'Search area (e.g. Hampankatta, Bajpe, Surathkal)...'
                  : 'Search destination (e.g. Bengaluru, Udupi, Manipal)...'
              }
              placeholderTextColor="#64748b"
              autoFocus
              clearButtonMode="while-editing"
            />
            {locationSearchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setLocationSearchQuery('')} style={styles.pickerClearBtn}>
                <Text style={styles.pickerClearText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Quick Action: Live GPS Location - ONLY for PICKUP */}
          {locationModalTarget === 'PICKUP' && (
            <TouchableOpacity
              style={styles.pickerLiveGpsBtn}
              onPress={async () => {
                setLocationModalVisible(false);
                await handleFetchCurrentLocation();
              }}
            >
              <Text style={styles.pickerLiveGpsIcon}>🎯</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.pickerLiveGpsTitle}>Use Current Live GPS Location</Text>
                <Text style={styles.pickerLiveGpsSub}>Detects exact device coordinates & street address</Text>
              </View>
              <Text style={styles.pickerLiveGpsArrow}>➔</Text>
            </TouchableOpacity>
          )}

          {/* Category Filter Tabs */}
          <View style={styles.pickerCategoryPills}>
            {[
              { id: 'ALL', label: 'All Places' },
              { id: 'MANGALURU', label: '🏖️ Mangaluru' },
              { id: 'AIRPORTS', label: '✈️ Airports / Rly' },
              { id: 'OUTSTATION', label: '🛣️ Outstation' },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.pickerCategoryPill,
                  locationCategoryFilter === tab.id && styles.pickerCategoryPillActive,
                ]}
                onPress={() => setLocationCategoryFilter(tab.id as any)}
              >
                <Text
                  style={[
                    styles.pickerCategoryPillText,
                    locationCategoryFilter === tab.id && styles.pickerCategoryPillTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom Address Option if user typed query */}
          {locationSearchQuery.trim().length > 0 && (
            <TouchableOpacity
              style={styles.pickerCustomAddressTile}
              onPress={() => handleSelectCustomAddress(locationSearchQuery)}
            >
              <Text style={styles.pickerCustomIcon}>✍️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.pickerCustomTitle}>Use Custom Address:</Text>
                <Text style={styles.pickerCustomAddressText} numberOfLines={1}>
                  "{locationSearchQuery.trim()}"
                </Text>
              </View>
              <Text style={styles.pickerCustomSelectText}>Select ➔</Text>
            </TouchableOpacity>
          )}

          {/* Results List */}
          <ScrollView
            style={styles.pickerResultsScroll}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            {isSearchingOsm && (
              <View style={styles.searchingRow}>
                <ActivityIndicator size="small" color="#f59e0b" style={{ marginRight: 8 }} />
                <Text style={styles.searchingText}>Searching OpenStreetMap for "{locationSearchQuery}"...</Text>
              </View>
            )}

            {/* Combined & Deduplicated Locations */}
            {(() => {
              const localFiltered = ALL_LOCATIONS.filter((loc) => {
                if (locationCategoryFilter !== 'ALL' && loc.category !== locationCategoryFilter) {
                  return false;
                }
                if (!locationSearchQuery.trim()) return true;
                const q = locationSearchQuery.toLowerCase();
                const matchLabel = loc.label.toLowerCase().includes(q);
                const matchSub = loc.sublabel?.toLowerCase().includes(q);
                const matchKeyword = loc.keywords?.some((k) => k.toLowerCase().includes(q));
                return matchLabel || matchSub || matchKeyword;
              });

              // Merge local filtered + live OSM results (avoiding duplicates)
              const combined: PlaceLocation[] = [...localFiltered];
              const seenLabels = new Set(localFiltered.map((l) => l.label.toLowerCase()));

              osmResults.forEach((osm) => {
                if (!seenLabels.has(osm.label.toLowerCase())) {
                  seenLabels.add(osm.label.toLowerCase());
                  combined.push(osm);
                }
              });

              if (combined.length === 0) {
                return (
                  <View style={styles.noResultsBox}>
                    <Text style={styles.noResultsIcon}>📍</Text>
                    <Text style={styles.noResultsTitle}>Location Not Found</Text>
                    <Text style={styles.noResultsSub}>
                      No verified place matched "{locationSearchQuery}".{'\n'}
                      Try searching by main area or landmark (e.g., Shakthinagar, Mudipu, Hampankatta, Bejai, Surathkal) or pick from the list below.
                    </Text>
                  </View>
                );
              }

              return combined.map((loc, idx) => {
                const isSelected =
                  locationModalTarget === 'PICKUP'
                    ? pickupAddress === loc.label
                    : dropAddress === loc.label;

                const isOsmLive = loc.source === 'OSM_LIVE';

                return (
                  <TouchableOpacity
                    key={`${loc.label}_${idx}`}
                    style={[
                      styles.pickerItem,
                      isSelected && styles.pickerItemActive,
                    ]}
                    onPress={() => handleSelectLocation(loc)}
                  >
                    <View style={styles.pickerItemIconBox}>
                      <Text style={styles.pickerItemIcon}>
                        {isOsmLive
                          ? '🌐'
                          : (loc.keywords?.includes('train') || loc.keywords?.includes('railway') || loc.label.toLowerCase().includes('railway'))
                          ? '🚆'
                          : (loc.keywords?.includes('bus stand') || loc.keywords?.includes('ksrtc') || loc.keywords?.includes('terminus'))
                          ? '🚌'
                          : loc.category === 'AIRPORTS'
                          ? '✈️'
                          : loc.category === 'MANGALURU'
                          ? '🏖️'
                          : '🛣️'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                        <Text
                          style={[
                            styles.pickerItemLabel,
                            isSelected && styles.pickerItemLabelActive,
                          ]}
                        >
                          {loc.label}
                        </Text>
                        {isOsmLive && (
                          <View style={styles.osmLiveBadge}>
                            <Text style={styles.osmLiveBadgeText}>OSM</Text>
                          </View>
                        )}
                      </View>
                      {loc.sublabel && (
                        <Text style={styles.pickerItemSub}>{loc.sublabel}</Text>
                      )}
                    </View>
                    {isSelected ? (
                      <Text style={styles.pickerItemCheck}>✓ Selected</Text>
                    ) : (
                      <Text style={styles.pickerItemSelectArrow}>›</Text>
                    )}
                  </TouchableOpacity>
                );
              });
            })()}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ========================================================================= */}
      {/* TRIP CONFIRMATION & 20% ADVANCE PAYMENT MODAL                            */}
      {/* ========================================================================= */}
      <Modal
        visible={confirmModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setConfirmModalVisible(false)}
      >
        <SafeAreaView style={styles.confirmModalSafeArea}>
          <View style={styles.confirmModalHeader}>
            <TouchableOpacity
              style={styles.confirmModalBackBtn}
              onPress={() => setConfirmModalVisible(false)}
            >
              <Text style={styles.confirmModalBackText}>← Back</Text>
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.confirmModalTitle}>Confirm Your Ride</Text>
              <Text style={styles.confirmModalSubTitle}>Review & Pay 20% Advance</Text>
            </View>
            <View style={{ width: 50 }} />
          </View>

          <ScrollView style={styles.confirmModalScroll} contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Step Indicator */}
            <View style={styles.stepProgressBar}>
              <View style={[styles.stepDot, styles.stepDotActive]}><Text style={styles.stepDotText}>✓</Text></View>
              <View style={[styles.stepLine, styles.stepLineActive]} />
              <View style={[styles.stepDot, styles.stepDotActive]}><Text style={styles.stepDotText}>✓</Text></View>
              <View style={[styles.stepLine, styles.stepLineActive]} />
              <View style={[styles.stepDot, styles.stepDotActive]}><Text style={styles.stepDotText}>3</Text></View>
            </View>
            <View style={styles.stepLabelRow}>
              <Text style={styles.stepLabel}>Route</Text>
              <Text style={styles.stepLabel}>Vehicle</Text>
              <Text style={[styles.stepLabel, { color: '#f59e0b', fontWeight: 'bold' }]}>Review & Pay</Text>
            </View>

            {/* Selected Vehicle Summary Card */}
            {(() => {
              const selectedVeh = VEHICLE_TYPES.find((v) => v.category === selectedCategory) || VEHICLE_TYPES[0];
              return (
                <View style={styles.confirmVehicleCard}>
                  <View style={styles.confirmVehIconBox}>
                    <Text style={{ fontSize: 28 }}>
                      {selectedCategory === VehicleCategory.HATCHBACK ? '🚗' : selectedCategory === VehicleCategory.SEDAN ? '🚘' : selectedCategory === VehicleCategory.SUV ? '🚙' : selectedCategory === VehicleCategory.SUV_PREMIUM ? '👑' : '🚐'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={styles.confirmVehTitle}>{selectedVeh.name}</Text>
                      <View style={[styles.confirmVehBadge, { backgroundColor: selectedVeh.badgeColor || '#f59e0b' }]}>
                        <Text style={styles.confirmVehBadgeText}>{selectedVeh.badge || 'Standard'}</Text>
                      </View>
                    </View>
                    <Text style={styles.confirmVehModels}>{selectedVeh.models}</Text>
                    <View style={styles.confirmVehSpecsRow}>
                      <Text style={styles.confirmVehSpec}>👥 {selectedVeh.capacity}</Text>
                      <Text style={styles.confirmVehSpec}>🧳 {selectedVeh.luggage}</Text>
                      <Text style={styles.confirmVehSpec}>⛽ {selectedFuelType}</Text>
                      <Text style={styles.confirmVehSpec}>❄️ AC</Text>
                    </View>
                  </View>
                </View>
              );
            })()}

            {/* Route & Schedule Summary */}
            <View style={styles.confirmRouteCard}>
              <View style={styles.confirmTripTypePill}>
                <Text style={styles.confirmTripTypeText}>
                  {selectedTripType === TripType.ONEWAY ? '🛣️ ONE WAY TRIP' : selectedTripType === TripType.ROUND ? '🔄 ROUND TRIP' : selectedTripType === TripType.AIRPORT ? '✈️ AIRPORT TRANSFER' : '⏱️ LOCAL HOURLY'}
                </Text>
              </View>

              <View style={styles.confirmRouteRow}>
                <Text style={{ fontSize: 14 }}>🟢</Text>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.confirmRouteLabel}>PICKUP LOCATION</Text>
                  <Text style={styles.confirmRouteAddress}>{pickupAddress}</Text>
                </View>
              </View>

              <View style={styles.confirmRouteDivider} />

              <View style={styles.confirmRouteRow}>
                <Text style={{ fontSize: 14 }}>🔴</Text>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.confirmRouteLabel}>DROP-OFF DESTINATION</Text>
                  <Text style={styles.confirmRouteAddress}>{dropAddress}</Text>
                </View>
              </View>

              <View style={styles.confirmRouteFooter}>
                <View style={styles.confirmRouteMetric}>
                  <Text style={styles.confirmMetricLabel}>DISTANCE</Text>
                  <Text style={styles.confirmMetricVal}>📍 {quoteResult?.distanceKm || 50} km</Text>
                </View>
                <View style={styles.confirmRouteMetric}>
                  <Text style={styles.confirmMetricLabel}>EST. TIME</Text>
                  <Text style={styles.confirmMetricVal}>⏱️ {quoteResult?.formattedDuration || '1 hr'}</Text>
                </View>
                <View style={styles.confirmRouteMetric}>
                  <Text style={styles.confirmMetricLabel}>DEPARTURE</Text>
                  <Text style={styles.confirmMetricVal}>📅 {pickupDate} @ {pickupTime}</Text>
                </View>
              </View>
            </View>

            {/* Passenger Information */}
            <View style={styles.confirmPassengerCard}>
              <Text style={styles.confirmSectionTitle}>👤 Passenger Details</Text>
              <View style={{ marginTop: 8 }}>
                <Text style={styles.confirmInputLabel}>Full Name</Text>
                <TextInput
                  style={styles.confirmTextInput}
                  value={passengerNameInput}
                  onChangeText={setPassengerNameInput}
                  placeholder="Enter passenger name"
                  placeholderTextColor="#64748b"
                />
              </View>
              <View style={{ marginTop: 8 }}>
                <Text style={styles.confirmInputLabel}>Contact Number (Driver will call this)</Text>
                <TextInput
                  style={styles.confirmTextInput}
                  value={passengerPhoneInput}
                  onChangeText={setPassengerPhoneInput}
                  placeholder="Enter 10-digit mobile number"
                  placeholderTextColor="#64748b"
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            {/* Fare & Advance Payment Summary Card */}
            <View style={styles.confirmFareCard}>
              <Text style={styles.confirmSectionTitle}>💳 Fare & Payment Breakdown</Text>
              <View style={styles.confirmFareRow}>
                <Text style={styles.confirmFareLabel}>Fuel Choice:</Text>
                <Text style={[styles.confirmFareVal, { color: '#f59e0b', fontWeight: 'bold' }]}>⛽ {selectedFuelType}</Text>
              </View>
              <View style={styles.confirmFareRow}>
                <Text style={styles.confirmFareLabel}>Estimated Total Fare:</Text>
                <Text style={styles.confirmFareVal}>₹{quoteResult?.quote?.pricing?.totalFare?.toLocaleString() || '1,200'}</Text>
              </View>
              <View style={[styles.confirmFareRow, styles.confirmAdvanceHighlightRow]}>
                <View>
                  <Text style={styles.confirmAdvanceTitle}>20% Advance Payable Now:</Text>
                  <Text style={styles.confirmAdvanceSub}>Required to book & lock your vehicle</Text>
                </View>
                <Text style={styles.confirmAdvanceVal}>₹{quoteResult?.quote?.pricing?.advanceAmount?.toLocaleString() || '240'}</Text>
              </View>
              <View style={styles.confirmFareRow}>
                <Text style={styles.confirmFareLabel}>Remaining 80% Balance:</Text>
                <Text style={styles.confirmFareVal}>₹{quoteResult?.quote?.pricing?.balanceAmount?.toLocaleString() || '960'}</Text>
              </View>
              <Text style={styles.confirmBalanceNote}>
                👉 The balance is payable to the driver at the end of the trip via Cash or UPI.
              </Text>
            </View>

            {/* Advance Payment Method Selection */}
            <View style={styles.confirmPaymentMethodCard}>
              <Text style={styles.confirmSectionTitle}>⚡ Select Advance Payment Method</Text>
              {[
                { id: 'UPI', label: 'UPI / Google Pay / PhonePe / Paytm', icon: '📱', desc: 'Instant UPI direct checkout' },
                { id: 'CARD', label: 'Credit / Debit Card', icon: '💳', desc: 'Visa, MasterCard, RuPay' },
                { id: 'NETBANKING', label: 'Net Banking', icon: '🏦', desc: 'All Indian major banks' },
                { id: 'FAST_CONFIRM', label: 'Instant App Advance Confirm', icon: '⚡', desc: 'Instant 1-click confirmation' },
              ].map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.paymentMethodOption,
                    selectedPaymentMethod === m.id && styles.paymentMethodOptionActive,
                  ]}
                  onPress={() => setSelectedPaymentMethod(m.id as any)}
                >
                  <Text style={{ fontSize: 20, marginRight: 12 }}>{m.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.paymentMethodTitle, selectedPaymentMethod === m.id && styles.paymentMethodTitleActive]}>
                      {m.label}
                    </Text>
                    <Text style={styles.paymentMethodDesc}>{m.desc}</Text>
                  </View>
                  <View style={[styles.radioCircle, selectedPaymentMethod === m.id && styles.radioCircleActive]}>
                    {selectedPaymentMethod === m.id && <View style={styles.radioDot} />}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Confirm & Pay Button */}
            <TouchableOpacity
              style={[styles.confirmPayBtn, paymentProcessing && styles.confirmPayBtnDisabled]}
              onPress={handleConfirmAdvancePayment}
              disabled={paymentProcessing}
            >
              {paymentProcessing ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <ActivityIndicator color="#020617" style={{ marginRight: 8 }} />
                  <Text style={styles.confirmPayBtnText}>Securing Advance & Confirming Cab...</Text>
                </View>
              ) : (
                <Text style={styles.confirmPayBtnText}>
                  🔒 Pay ₹{quoteResult?.quote?.pricing?.advanceAmount?.toLocaleString() || '240'} Advance & Confirm Cab →
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>


    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#020617',
  },
  topNotice: {
    backgroundColor: '#0f172a',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
  },
  topNoticeText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#020617',
    borderBottomWidth: 1,
    borderColor: '#1e293b',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogoImage: {
    width: 140,
    height: 36,
  },
  logoutBtn: {
    backgroundColor: '#1e293b',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  logoutText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  navTabs: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    padding: 6,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  navTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  navTabActive: {
    backgroundColor: '#f59e0b',
  },
  navTabText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
  },
  navTabTextActive: {
    color: '#020617',
    fontWeight: '900',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  bookingFunnel: {
    width: '100%',
  },
  bookingsContainer: {
    width: '100%',
  },
  heroBanner: {
    marginBottom: 16,
  },
  heroTag: {
    backgroundColor: '#3b2505',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  heroTagText: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '800',
  },
  heroTitle: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 28,
  },
  heroTitleHighlight: {
    color: '#f59e0b',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 28,
    marginBottom: 6,
  },
  heroSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 16,
  },
  tripTypeTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  tripTypeTab: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  tripTypeTabActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  tripTypeTabText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  tripTypeTabTextActive: {
    color: '#020617',
    fontWeight: '900',
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  fieldLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  currentLocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  currentLocIcon: {
    fontSize: 10,
    marginRight: 4,
  },
  currentLocText: {
    color: '#020617',
    fontSize: 10,
    fontWeight: '900',
  },
  locationSelectorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#020617',
    borderWidth: 1.5,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
  },
  locationSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  locationSelectorIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  locationSelectorLabel: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '800',
  },
  locationSelectorSub: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
  locationChangeBadge: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#f59e0b',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  locationChangeBadgeText: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '800',
  },
  dropdownToggleSmall: {
    backgroundColor: '#1e293b',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  dropdownToggleSmallText: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '800',
  },

  // Full Screen / Dedicated Location Picker Modal Styles
  pickerModalContainer: {
    flex: 1,
    backgroundColor: '#020617',
  },
  pickerModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#1e293b',
    backgroundColor: '#020617',
  },
  pickerModalBackBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#1e293b',
    borderRadius: 8,
  },
  pickerModalBackText: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '800',
  },
  pickerModalTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '900',
  },
  pickerSearchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  pickerSearchIcon: {
    fontSize: 15,
    marginRight: 8,
  },
  pickerSearchInput: {
    flex: 1,
    paddingVertical: 12,
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
  },
  pickerClearBtn: {
    padding: 6,
  },
  pickerClearText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: 'bold',
  },
  pickerLiveGpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#38bdf8',
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pickerLiveGpsIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  pickerLiveGpsTitle: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '900',
  },
  pickerLiveGpsSub: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 1,
  },
  pickerLiveGpsArrow: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '900',
  },
  pickerCategoryPills: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 6,
  },
  pickerCategoryPill: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  pickerCategoryPillActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  pickerCategoryPillText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  pickerCategoryPillTextActive: {
    color: '#020617',
    fontWeight: '900',
  },
  pickerCustomAddressTile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#172554',
    borderWidth: 1,
    borderColor: '#60a5fa',
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pickerCustomIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  pickerCustomTitle: {
    color: '#93c5fd',
    fontSize: 10,
    fontWeight: '800',
  },
  pickerCustomAddressText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 1,
  },
  pickerCustomSelectText: {
    color: '#60a5fa',
    fontSize: 11,
    fontWeight: '900',
  },
  pickerResultsScroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  pickerItemActive: {
    borderColor: '#f59e0b',
    backgroundColor: '#3b2505',
  },
  pickerItemIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  pickerItemIcon: {
    fontSize: 16,
  },
  pickerItemLabel: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '800',
  },
  pickerItemLabelActive: {
    color: '#f59e0b',
    fontWeight: '900',
  },
  pickerItemSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  pickerItemCheck: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '900',
    backgroundColor: '#064e3b',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  pickerItemSelectArrow: {
    color: '#64748b',
    fontSize: 18,
    fontWeight: 'bold',
  },
  searchingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    marginBottom: 10,
  },
  searchingText: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '700',
  },
  osmLiveBadge: {
    backgroundColor: '#0369a1',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    marginLeft: 6,
  },
  osmLiveBadgeText: {
    color: '#e0f2fe',
    fontSize: 9,
    fontWeight: '900',
  },
  noResultsBox: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 24,
    alignItems: 'center',
    marginVertical: 12,
  },
  noResultsIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  noResultsTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  noResultsSub: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  fieldInput: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
  },
  chipsRow: {
    marginTop: 6,
  },
  chip: {
    backgroundColor: '#1e293b',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginRight: 6,
  },
  chipCurrentLoc: {
    backgroundColor: '#064e3b',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  chipCurrentLocText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '800',
  },
  chipActive: {
    backgroundColor: '#3b2505',
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  chipText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#f59e0b',
    fontWeight: '800',
  },
  rowTwoCols: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  vehicleCardsRow: {
    marginTop: 4,
  },
  vehicleCard: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 12,
    width: 140,
    marginRight: 10,
  },
  vehicleCardActive: {
    borderColor: '#f59e0b',
    backgroundColor: '#1e293b',
    borderWidth: 2,
  },
  vehicleBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  vehicleBadgeText: {
    color: '#020617',
    fontSize: 9,
    fontWeight: '900',
  },
  vehicleName: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '800',
  },
  vehicleModels: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 2,
  },
  vehicleSpecs: {
    marginVertical: 6,
  },
  vehicleSpecText: {
    color: '#94a3b8',
    fontSize: 10,
  },
  vehicleRate: {
    color: '#f59e0b',
    fontSize: 13,
    fontWeight: '900',
  },
  fuelOptionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  fuelCard: {
    flex: 1,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fuelCardActive: {
    borderColor: '#f59e0b',
    backgroundColor: '#1e293b',
    borderWidth: 1.5,
  },
  fuelCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fuelName: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  fuelNameActive: {
    color: '#f8fafc',
    fontWeight: '800',
  },
  fuelPrice: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
  },
  fuelPriceActive: {
    color: '#f59e0b',
  },
  fuelSelectedCheck: {
    marginTop: 4,
    backgroundColor: '#3b2505',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fuelCheckText: {
    color: '#f59e0b',
    fontSize: 9,
    fontWeight: '800',
  },
  calculateBtn: {
    backgroundColor: '#020617',
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 12,
  },
  calculateBtnText: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '800',
  },
  fareResultBox: {
    backgroundColor: '#020617',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 14,
  },
  fareHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderColor: '#1e293b',
    paddingBottom: 8,
  },
  fareTotalLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '800',
  },
  fareTotalAmount: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '900',
  },
  tripMetricBadge: {
    backgroundColor: '#1e293b',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  metricText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '700',
  },
  fareBreakdown: {
    gap: 4,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  breakdownLabel: {
    color: '#94a3b8',
    fontSize: 12,
  },
  breakdownAdvance: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '800',
  },
  breakdownBalance: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700',
  },
  breakdownNote: {
    color: '#34d399',
    fontSize: 10,
    marginTop: 4,
    fontWeight: '600',
  },
  bookBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  bookBtnDisabled: {
    opacity: 0.6,
  },
  bookBtnText: {
    color: '#020617',
    fontSize: 15,
    fontWeight: '900',
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  metricNumber: {
    color: '#f59e0b',
    fontSize: 16,
    fontWeight: '900',
  },
  metricLabel: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 2,
  },
  statusFilters: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  statusFilterTab: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  statusFilterTabActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  statusFilterText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  statusFilterTextActive: {
    color: '#020617',
    fontWeight: '900',
  },
  centerBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingMessage: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 10,
  },
  emptyContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '800',
  },
  emptySubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  emptyActionBtn: {
    backgroundColor: '#f59e0b',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  emptyActionText: {
    color: '#020617',
    fontSize: 13,
    fontWeight: '800',
  },
  bookingCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  refText: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '900',
  },
  tripTypeText: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusActive: {
    backgroundColor: '#064e3b',
  },
  statusCompleted: {
    backgroundColor: '#1e293b',
  },
  statusCancelled: {
    backgroundColor: '#450a0a',
  },
  statusBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  sharingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  sharingTitle: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '800',
  },
  sharingSub: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 2,
  },
  driverArrivedAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#064e3b',
    borderWidth: 1.5,
    borderColor: '#10b981',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  driverNearAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0c4a6e',
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  driverAlertTitleGreen: {
    color: '#6ee7b7',
    fontSize: 13,
    fontWeight: '900',
  },
  driverAlertTitleBlue: {
    color: '#7dd3fc',
    fontSize: 13,
    fontWeight: '900',
  },
  driverAlertSub: {
    color: '#f8fafc',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  otpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#3b2505',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  otpLabel: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '900',
  },
  otpHint: {
    color: '#fcd34d',
    fontSize: 10,
    marginTop: 2,
  },
  otpCode: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 4,
  },
  routeBox: {
    backgroundColor: '#020617',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    marginBottom: 12,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  routeDotGreen: {
    fontSize: 12,
    marginTop: 2,
  },
  routeDotRed: {
    fontSize: 12,
    marginTop: 2,
  },
  routeField: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '800',
  },
  routeText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '600',
  },
  summaryBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#1e293b',
    paddingVertical: 10,
    marginBottom: 12,
  },
  summaryCol: {
    alignItems: 'center',
  },
  summaryLabel: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '800',
  },
  summaryVal: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#020617',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  driverAvatar: {
    backgroundColor: '#f59e0b',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverAvatarText: {
    color: '#020617',
    fontWeight: '900',
    fontSize: 15,
  },
  driverName: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '800',
  },
  driverCar: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  callBtn: {
    backgroundColor: '#064e3b',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  callBtnText: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '800',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  invoiceBtn: {
    backgroundColor: '#1e293b',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  invoiceBtnText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700',
  },
  rateDriverBtn: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  rateDriverBtnText: {
    color: 'rgb(240, 117, 15)',
    fontSize: 12,
    fontWeight: '800',
  },
  rateDriverBtnRated: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  rateDriverBtnRatedText: {
    color: '#b45309',
  },
  cancelBtn: {
    backgroundColor: '#450a0a',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  cancelBtnText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 12,
  },
  invoiceContent: {
    backgroundColor: '#020617',
    padding: 14,
    borderRadius: 10,
  },
  invoiceHeader: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  invoiceSub: {
    color: '#94a3b8',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#1e293b',
    marginVertical: 10,
  },
  invoiceText: {
    color: '#94a3b8',
    fontSize: 11,
    marginBottom: 4,
  },
  invoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  invoiceVal: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '700',
  },
  closeModalBtn: {
    backgroundColor: '#f59e0b',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  closeModalText: {
    color: '#020617',
    fontSize: 14,
    fontWeight: '900',
  },
  // Trip Confirmation & Advance Payment Modal Styles
  confirmModalSafeArea: {
    flex: 1,
    backgroundColor: '#020617',
  },
  confirmModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderColor: '#1e293b',
  },
  confirmModalBackBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#1e293b',
    borderRadius: 8,
  },
  confirmModalBackText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '800',
  },
  confirmModalTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '900',
  },
  confirmModalSubTitle: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  confirmModalScroll: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  stepProgressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: '#f59e0b',
  },
  stepDotText: {
    color: '#020617',
    fontSize: 11,
    fontWeight: '900',
  },
  stepLine: {
    width: 50,
    height: 3,
    backgroundColor: '#1e293b',
  },
  stepLineActive: {
    backgroundColor: '#f59e0b',
  },
  stepLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 30,
    marginBottom: 16,
  },
  stepLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
  },
  confirmVehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
    marginBottom: 12,
  },
  confirmVehIconBox: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  confirmVehTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '900',
  },
  confirmVehBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  confirmVehBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  confirmVehModels: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  confirmVehSpecsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  confirmVehSpec: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
    backgroundColor: '#1e293b',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  confirmRouteCard: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
    marginBottom: 12,
  },
  confirmTripTypePill: {
    backgroundColor: '#3b2505',
    borderWidth: 1,
    borderColor: '#f59e0b',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  confirmTripTypeText: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '900',
  },
  confirmRouteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  confirmRouteLabel: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '800',
  },
  confirmRouteAddress: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 1,
  },
  confirmRouteDivider: {
    height: 1,
    backgroundColor: '#1e293b',
    marginVertical: 10,
    marginLeft: 24,
  },
  confirmRouteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderColor: '#1e293b',
    marginTop: 12,
    paddingTop: 10,
  },
  confirmRouteMetric: {
    alignItems: 'center',
  },
  confirmMetricLabel: {
    color: '#64748b',
    fontSize: 8,
    fontWeight: '800',
  },
  confirmMetricVal: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  confirmPassengerCard: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
    marginBottom: 12,
  },
  confirmSectionTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 4,
  },
  confirmInputLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  confirmTextInput: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
  },
  confirmFareCard: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
    marginBottom: 12,
  },
  confirmFareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  confirmFareLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  confirmFareVal: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
  },
  confirmAdvanceHighlightRow: {
    backgroundColor: '#1e293b',
    padding: 10,
    borderRadius: 8,
    marginVertical: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  confirmAdvanceTitle: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '900',
  },
  confirmAdvanceSub: {
    color: '#94a3b8',
    fontSize: 9,
    marginTop: 1,
  },
  confirmAdvanceVal: {
    color: '#f59e0b',
    fontSize: 16,
    fontWeight: '900',
  },
  confirmBalanceNote: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 6,
  },
  confirmPaymentMethodCard: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
    marginBottom: 16,
  },
  paymentMethodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  paymentMethodOptionActive: {
    borderColor: '#f59e0b',
    backgroundColor: '#3b2505',
  },
  paymentMethodTitle: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '800',
  },
  paymentMethodTitleActive: {
    color: '#f59e0b',
  },
  paymentMethodDesc: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 1,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#64748b',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  radioCircleActive: {
    borderColor: '#f59e0b',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#f59e0b',
  },
  confirmPayBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  confirmPayBtnDisabled: {
    opacity: 0.6,
  },
  confirmPayBtnText: {
    color: '#020617',
    fontSize: 15,
    fontWeight: '900',
  },
});
