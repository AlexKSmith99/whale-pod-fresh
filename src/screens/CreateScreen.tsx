import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Alert, Switch, Modal, FlatList, StatusBar, Keyboard, Dimensions,
  Platform, KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { pursuitService } from '../services/pursuitService';
import LocationMapView from '../components/ui/LocationMapView';
import { PURSUIT_TYPES } from '../constants/pursuitTypes';
import { NEIGHBORHOODS } from '../constants/neighborhoods';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOTAL_PAGES = 3;

// Design tokens (matching OnboardingScreen)
const C = {
  bg: '#F6FAF8',
  ink: '#1B1B18',
  muted: '#8A8A85',
  accent: '#2D5016',
  accentLine: '#A8D4B8',
  border: '#CCD6D0',
  white: '#FFFFFF',
  gradientTop: '#DCE8E0',
};

const F = {
  title: 'NothingYouCouldDo_400Regular',
  header: 'PlayfairDisplay_700Bold',
  body: 'Sora_400Regular',
  bodyMedium: 'Sora_600SemiBold',
};

const DECISION_SYSTEMS = ['Standard Vote', 'Admin Has Ultimate Say', 'Delegated', 'Weighted Voting'];
const ATTENDANCE_STYLES = ['Mandatory', 'Optional', 'Frequent'];

const US_STATES = [
  { name: 'Alabama', abbr: 'AL' }, { name: 'Alaska', abbr: 'AK' }, { name: 'Arizona', abbr: 'AZ' }, { name: 'Arkansas', abbr: 'AR' },
  { name: 'California', abbr: 'CA' }, { name: 'Colorado', abbr: 'CO' }, { name: 'Connecticut', abbr: 'CT' }, { name: 'Delaware', abbr: 'DE' },
  { name: 'Florida', abbr: 'FL' }, { name: 'Georgia', abbr: 'GA' }, { name: 'Hawaii', abbr: 'HI' }, { name: 'Idaho', abbr: 'ID' },
  { name: 'Illinois', abbr: 'IL' }, { name: 'Indiana', abbr: 'IN' }, { name: 'Iowa', abbr: 'IA' }, { name: 'Kansas', abbr: 'KS' },
  { name: 'Kentucky', abbr: 'KY' }, { name: 'Louisiana', abbr: 'LA' }, { name: 'Maine', abbr: 'ME' }, { name: 'Maryland', abbr: 'MD' },
  { name: 'Massachusetts', abbr: 'MA' }, { name: 'Michigan', abbr: 'MI' }, { name: 'Minnesota', abbr: 'MN' }, { name: 'Mississippi', abbr: 'MS' },
  { name: 'Missouri', abbr: 'MO' }, { name: 'Montana', abbr: 'MT' }, { name: 'Nebraska', abbr: 'NE' }, { name: 'Nevada', abbr: 'NV' },
  { name: 'New Hampshire', abbr: 'NH' }, { name: 'New Jersey', abbr: 'NJ' }, { name: 'New Mexico', abbr: 'NM' }, { name: 'New York', abbr: 'NY' },
  { name: 'North Carolina', abbr: 'NC' }, { name: 'North Dakota', abbr: 'ND' }, { name: 'Ohio', abbr: 'OH' }, { name: 'Oklahoma', abbr: 'OK' },
  { name: 'Oregon', abbr: 'OR' }, { name: 'Pennsylvania', abbr: 'PA' }, { name: 'Rhode Island', abbr: 'RI' }, { name: 'South Carolina', abbr: 'SC' },
  { name: 'South Dakota', abbr: 'SD' }, { name: 'Tennessee', abbr: 'TN' }, { name: 'Texas', abbr: 'TX' }, { name: 'Utah', abbr: 'UT' },
  { name: 'Vermont', abbr: 'VT' }, { name: 'Virginia', abbr: 'VA' }, { name: 'Washington', abbr: 'WA' }, { name: 'West Virginia', abbr: 'WV' },
  { name: 'Wisconsin', abbr: 'WI' }, { name: 'Wyoming', abbr: 'WY' }
];

// City to state(s) mapping - cities can exist in multiple states
const CITY_STATE_MAP: { [city: string]: string[] } = {
  'New York': ['NY'], 'Los Angeles': ['CA'], 'Chicago': ['IL'], 'Houston': ['TX'], 'Phoenix': ['AZ'],
  'Philadelphia': ['PA'], 'San Antonio': ['TX'], 'San Diego': ['CA'], 'Dallas': ['TX'], 'San Jose': ['CA'],
  'Austin': ['TX'], 'Jacksonville': ['FL'], 'Fort Worth': ['TX'], 'Columbus': ['OH', 'GA'], 'Charlotte': ['NC'],
  'San Francisco': ['CA'], 'Indianapolis': ['IN'], 'Seattle': ['WA'], 'Denver': ['CO'], 'Washington': ['DC'],
  'Boston': ['MA'], 'El Paso': ['TX'], 'Nashville': ['TN'], 'Detroit': ['MI'], 'Oklahoma City': ['OK'],
  'Portland': ['OR', 'ME'], 'Las Vegas': ['NV'], 'Memphis': ['TN'], 'Louisville': ['KY'], 'Baltimore': ['MD'],
  'Milwaukee': ['WI'], 'Albuquerque': ['NM'], 'Tucson': ['AZ'], 'Fresno': ['CA'], 'Mesa': ['AZ'],
  'Sacramento': ['CA'], 'Atlanta': ['GA'], 'Kansas City': ['MO', 'KS'], 'Colorado Springs': ['CO'], 'Omaha': ['NE'],
  'Raleigh': ['NC'], 'Miami': ['FL'], 'Long Beach': ['CA'], 'Virginia Beach': ['VA'], 'Oakland': ['CA'],
  'Minneapolis': ['MN'], 'Tulsa': ['OK'], 'Tampa': ['FL'], 'Arlington': ['TX', 'VA'], 'New Orleans': ['LA'],
  'Wichita': ['KS'], 'Cleveland': ['OH'], 'Bakersfield': ['CA'], 'Aurora': ['CO', 'IL'], 'Anaheim': ['CA'],
  'Honolulu': ['HI'], 'Santa Ana': ['CA'], 'Riverside': ['CA'], 'Corpus Christi': ['TX'], 'Lexington': ['KY'],
  'Henderson': ['NV'], 'Stockton': ['CA'], 'Saint Paul': ['MN'], 'Cincinnati': ['OH'], 'St. Louis': ['MO'],
  'Pittsburgh': ['PA'], 'Greensboro': ['NC'], 'Lincoln': ['NE'], 'Anchorage': ['AK'], 'Plano': ['TX'],
  'Orlando': ['FL'], 'Irvine': ['CA'], 'Newark': ['NJ'], 'Durham': ['NC'], 'Chula Vista': ['CA'],
  'Toledo': ['OH'], 'Fort Wayne': ['IN'], 'St. Petersburg': ['FL'], 'Laredo': ['TX'], 'Jersey City': ['NJ'],
  'Chandler': ['AZ'], 'Madison': ['WI'], 'Lubbock': ['TX'], 'Scottsdale': ['AZ'], 'Reno': ['NV'],
  'Buffalo': ['NY'], 'Gilbert': ['AZ'], 'Glendale': ['AZ', 'CA'], 'North Las Vegas': ['NV'], 'Winston-Salem': ['NC'],
  'Chesapeake': ['VA'], 'Norfolk': ['VA'], 'Fremont': ['CA'], 'Garland': ['TX'], 'Irving': ['TX'],
  'Hialeah': ['FL'], 'Richmond': ['VA', 'CA'], 'Boise': ['ID'], 'Spokane': ['WA'], 'Baton Rouge': ['LA'],
  'Tacoma': ['WA'], 'San Bernardino': ['CA'], 'Modesto': ['CA'], 'Fontana': ['CA'], 'Des Moines': ['IA'],
  'Moreno Valley': ['CA'], 'Santa Clarita': ['CA'], 'Fayetteville': ['NC', 'AR'], 'Birmingham': ['AL'], 'Oxnard': ['CA'],
  'Rochester': ['NY', 'MN'], 'Port St. Lucie': ['FL'], 'Grand Rapids': ['MI'], 'Huntsville': ['AL'], 'Salt Lake City': ['UT'],
  'Frisco': ['TX'], 'Yonkers': ['NY'], 'Amarillo': ['TX'], 'Huntington Beach': ['CA'],
  'McKinney': ['TX'], 'Montgomery': ['AL'], 'Augusta': ['GA', 'ME'], 'Akron': ['OH'], 'Little Rock': ['AR'],
  'Tempe': ['AZ'], 'Overland Park': ['KS'], 'Grand Prairie': ['TX'],
  'Tallahassee': ['FL'], 'Cape Coral': ['FL'], 'Mobile': ['AL'], 'Knoxville': ['TN'], 'Shreveport': ['LA'],
  'Worcester': ['MA'], 'Ontario': ['CA'], 'Vancouver': ['WA'], 'Sioux Falls': ['SD'], 'Chattanooga': ['TN'],
  'Brownsville': ['TX'], 'Fort Lauderdale': ['FL'], 'Providence': ['RI'], 'Newport News': ['VA'],
  'Rancho Cucamonga': ['CA'], 'Santa Rosa': ['CA'], 'Peoria': ['AZ', 'IL'], 'Oceanside': ['CA'], 'Elk Grove': ['CA'],
  'Salem': ['OR', 'MA'], 'Pembroke Pines': ['FL'], 'Eugene': ['OR'], 'Garden Grove': ['CA'], 'Cary': ['NC'],
  'Fort Collins': ['CO'], 'Corona': ['CA'], 'Springfield': ['IL', 'MO', 'MA', 'OH'], 'Jackson': ['MS', 'TN'],
  'Alexandria': ['VA', 'LA'], 'Hayward': ['CA'], 'Clarksville': ['TN'], 'Lakewood': ['CO', 'CA', 'NJ', 'OH'],
  'Lancaster': ['CA', 'PA'], 'Salinas': ['CA'], 'Palmdale': ['CA'], 'Hollywood': ['FL'], 'Macon': ['GA'],
  'Sunnyvale': ['CA'], 'Pomona': ['CA'], 'Killeen': ['TX'], 'Escondido': ['CA'], 'Pasadena': ['CA', 'TX'],
  'Naperville': ['IL'], 'Bellevue': ['WA'], 'Joliet': ['IL'], 'Murfreesboro': ['TN'], 'Midland': ['TX'],
  'Rockford': ['IL'], 'Paterson': ['NJ'], 'Savannah': ['GA'], 'Bridgeport': ['CT'], 'Torrance': ['CA'],
  'McAllen': ['TX'], 'Syracuse': ['NY'], 'Surprise': ['AZ'], 'Denton': ['TX'], 'Roseville': ['CA'],
  'Thornton': ['CO'], 'Miramar': ['FL'], 'Mesquite': ['TX'], 'Olathe': ['KS'], 'Dayton': ['OH'],
  'Carrollton': ['TX'], 'Waco': ['TX'], 'Orange': ['CA'], 'Fullerton': ['CA'], 'Charleston': ['SC', 'WV'],
  'West Valley City': ['UT'], 'Visalia': ['CA'], 'Hampton': ['VA'], 'Gainesville': ['FL'], 'Warren': ['MI'],
  'Coral Springs': ['FL'], 'Cedar Rapids': ['IA'], 'Round Rock': ['TX'], 'Sterling Heights': ['MI'], 'Kent': ['WA'],
  'Columbia': ['SC', 'MO', 'MD'], 'Santa Clara': ['CA'], 'New Haven': ['CT'], 'Stamford': ['CT'],
  'Concord': ['CA', 'NC', 'NH'], 'Elizabeth': ['NJ'], 'Athens': ['GA'], 'Thousand Oaks': ['CA'],
  'Lafayette': ['LA', 'IN'], 'Simi Valley': ['CA'], 'Topeka': ['KS'], 'Norman': ['OK'], 'Fargo': ['ND'],
  'Wilmington': ['DE', 'NC'], 'Abilene': ['TX'], 'Odessa': ['TX'], 'Pearland': ['TX'], 'Victorville': ['CA'],
  'Hartford': ['CT'], 'Vallejo': ['CA'], 'Allentown': ['PA'], 'Berkeley': ['CA'], 'Richardson': ['TX'],
  'Arvada': ['CO'], 'Ann Arbor': ['MI'], 'Cambridge': ['MA'], 'Sugar Land': ['TX'], 'Lansing': ['MI'],
  'Evansville': ['IN'], 'College Station': ['TX'], 'Fairfield': ['CA', 'CT'], 'Clearwater': ['FL'],
  'Beaumont': ['TX'], 'Independence': ['MO'], 'Provo': ['UT'], 'West Jordan': ['UT'], 'Murrieta': ['CA'],
  'Palm Bay': ['FL'], 'El Monte': ['CA'], 'Carlsbad': ['CA'], 'North Charleston': ['SC'], 'Temecula': ['CA'],
  'Clovis': ['CA', 'NM'], 'Meridian': ['ID', 'MS'], 'Westminster': ['CO', 'CA'], 'Costa Mesa': ['CA'],
  'High Point': ['NC'], 'Manchester': ['NH'], 'Pueblo': ['CO'], 'Lakeland': ['FL'], 'Pompano Beach': ['FL'],
  'West Palm Beach': ['FL'], 'Antioch': ['CA'], 'Everett': ['WA'], 'Downey': ['CA'], 'Lowell': ['MA'],
  'Centennial': ['CO'], 'Elgin': ['IL'], 'Broken Arrow': ['OK'], 'Miami Gardens': ['FL'], 'Billings': ['MT'],
  'Jurupa Valley': ['CA'], 'Sandy Springs': ['GA'], 'Gresham': ['OR'], 'Lewisville': ['TX'], 'Hillsboro': ['OR'],
  'Ventura': ['CA'], 'Greeley': ['CO'], 'Inglewood': ['CA'], 'Waterbury': ['CT'], 'League City': ['TX'],
  'Santa Maria': ['CA'], 'Tyler': ['TX'], 'Davie': ['FL'], 'Daly City': ['CA'], 'Boulder': ['CO'],
  'Allen': ['TX'], 'West Covina': ['CA'], 'Sparks': ['NV'], 'Wichita Falls': ['TX'], 'Green Bay': ['WI'],
  'San Mateo': ['CA'], 'Norwalk': ['CA', 'CT'], 'Rialto': ['CA'], 'Las Cruces': ['NM'], 'Chico': ['CA'],
  'El Cajon': ['CA'], 'Burbank': ['CA'], 'South Bend': ['IN'], 'Renton': ['WA'], 'Vista': ['CA'],
  'Davenport': ['IA'], 'Edinburg': ['TX'], 'Tuscaloosa': ['AL'], 'Carmel': ['IN'], 'Spokane Valley': ['WA'],
  'San Angelo': ['TX'], 'Vacaville': ['CA'], 'Clinton': ['MD', 'MS'], 'Bend': ['OR'], 'Woodbridge': ['NJ', 'VA']
};

// Get all unique city names
const US_CITIES = Object.keys(CITY_STATE_MAP).sort();

interface Props {
  onClose?: () => void;
}

export default function CreateScreen({ onClose }: Props = {}) {
  const { user } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);

  const [currentPage, setCurrentPage] = useState(0);

  // Basic Info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [teamSizeMin, setTeamSizeMin] = useState('2');
  const [teamSizeMax, setTeamSizeMax] = useState('8');
  const [teamSizeFlexible, setTeamSizeFlexible] = useState(false);
  const [locationTypes, setLocationTypes] = useState<string[]>([]);
  const [locationCity, setLocationCity] = useState('');
  const [locationState, setLocationState] = useState('');
  const [citySearchQuery, setCitySearchQuery] = useState('');
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [showStateModal, setShowStateModal] = useState(false);
  const [neighborhood, setNeighborhood] = useState('');
  const [neighborhoodSearch, setNeighborhoodSearch] = useState('');
  const [showNeighborhoodSuggestions, setShowNeighborhoodSuggestions] = useState(false);
  const [address, setAddress] = useState('');
  const [pinLatitude, setPinLatitude] = useState<number | null>(null);
  const [pinLongitude, setPinLongitude] = useState<number | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [projectedDuration, setProjectedDuration] = useState('');

  // Types & Categories
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [categories, setCategories] = useState('');
  const [showPursuitTypeModal, setShowPursuitTypeModal] = useState(false);
  const [pursuitTypeSearch, setPursuitTypeSearch] = useState('');

  // Business
  const [ownershipStructure, setOwnershipStructure] = useState('');

  // Decision & Meeting
  const [decisionSystem, setDecisionSystem] = useState('Standard Vote');
  const [decisionNote, setDecisionNote] = useState('');
  const [meetingCadence, setMeetingCadence] = useState('');
  const [meetingNote, setMeetingNote] = useState('');
  const [attendanceStyle, setAttendanceStyle] = useState('Mandatory');
  const [attendanceNote, setAttendanceNote] = useState('');

  // Optional Fields
  const [accountabilityMechanics, setAccountabilityMechanics] = useState('');
  const [roles, setRoles] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [currentStage, setCurrentStage] = useState('');
  const [ageRestriction, setAgeRestriction] = useState('');

  // Application Settings
  const [continueAccepting, setContinueAccepting] = useState(false);
  const [requiresInterview, setRequiresInterview] = useState(false);
  const [requiresResume, setRequiresResume] = useState(false);
  const [resumeMode, setResumeMode] = useState<'off' | 'optional' | 'mandatory'>('off');
  const [portfolioMode, setPortfolioMode] = useState<'off' | 'optional' | 'mandatory'>('off');
  const [includeDefaultQuestions, setIncludeDefaultQuestions] = useState(true);
  const [applicationQuestions, setApplicationQuestions] = useState<string[]>(['']);
  const [isOpenPod, setIsOpenPod] = useState(false);

  const [loading, setLoading] = useState(false);

  // ===== BUSINESS LOGIC (preserved) =====

  const geocodeAddress = async () => {
    if (!address.trim() || !locationCity.trim()) return;
    setGeocoding(true);
    try {
      const query = `${address.trim()}, ${locationCity.trim()}, ${locationState.trim()}`;
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
        { headers: { 'User-Agent': 'WhalePod/1.0' } }
      );
      const results = await response.json();
      if (results.length > 0) {
        const { lat, lon } = results[0];
        setPinLatitude(parseFloat(lat));
        setPinLongitude(parseFloat(lon));
      }
    } catch (err) {
      // Silently fail — user can still manually pin
    } finally {
      setGeocoding(false);
    }
  };

  const toggleType = (type: string) => {
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter(t => t !== type));
    } else if (selectedTypes.length < 5) {
      setSelectedTypes([...selectedTypes, type]);
    } else {
      Alert.alert('Limit Reached', 'You can select up to 5 pod types');
    }
  };

  const toggleLocationType = (type: string) => {
    if (locationTypes.includes(type)) {
      setLocationTypes(locationTypes.filter(t => t !== type));
    } else {
      setLocationTypes([...locationTypes, type]);
    }
  };

  const handleCitySearch = (text: string) => {
    setCitySearchQuery(text);
    if (text.trim().length > 0) {
      setShowCitySuggestions(true);
    } else {
      setShowCitySuggestions(false);
    }
  };

  const selectCity = (city: string) => {
    setLocationCity(city);
    setCitySearchQuery(city);
    setShowCitySuggestions(false);
    setNeighborhood('');
    setNeighborhoodSearch('');
    setShowNeighborhoodSuggestions(false);

    const statesForCity = CITY_STATE_MAP[city];
    if (statesForCity && statesForCity.length === 1) {
      setLocationState(statesForCity[0]);
    } else if (statesForCity && locationState && !statesForCity.includes(locationState)) {
      setLocationState('');
    }
  };

  const selectState = (stateAbbr: string) => {
    if (locationState === stateAbbr) {
      setLocationState('');
      setShowStateModal(false);
      return;
    }

    setLocationState(stateAbbr);
    setShowStateModal(false);

    if (locationCity && CITY_STATE_MAP[locationCity] && !CITY_STATE_MAP[locationCity].includes(stateAbbr)) {
      setLocationCity('');
      setCitySearchQuery('');
    }
  };

  const clearState = () => {
    setLocationState('');
    setShowStateModal(false);
  };

  const handleNeighborhoodSearch = (text: string) => {
    setNeighborhoodSearch(text);
    if (text.trim().length > 0) {
      setShowNeighborhoodSuggestions(true);
    } else {
      setShowNeighborhoodSuggestions(false);
    }
  };

  const selectNeighborhood = (hood: string) => {
    setNeighborhood(hood);
    setNeighborhoodSearch(hood);
    setShowNeighborhoodSuggestions(false);
  };

  const availableNeighborhoods = locationCity ? (NEIGHBORHOODS[locationCity] || []) : [];
  const filteredNeighborhoods = availableNeighborhoods.filter(hood =>
    hood.toLowerCase().startsWith(neighborhoodSearch.toLowerCase())
  ).slice(0, 8);

  const filteredCities = US_CITIES.filter(city => {
    const matchesSearch = city.toLowerCase().startsWith(citySearchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (locationState) {
      const statesForCity = CITY_STATE_MAP[city];
      return statesForCity && statesForCity.includes(locationState);
    }
    return true;
  }).slice(0, 10);

  const filteredStates = US_STATES.filter(state => {
    if (locationCity && CITY_STATE_MAP[locationCity]) {
      return CITY_STATE_MAP[locationCity].includes(state.abbr);
    }
    return true;
  });

  const handleCreate = async () => {
    if (!title || !description || !meetingCadence) {
      Alert.alert('Missing Fields', 'Please fill in all required fields (marked with *)');
      return;
    }

    if (description.length < 50) {
      Alert.alert('Description Too Short', 'Description must be at least 50 characters');
      return;
    }

    if (selectedTypes.length < 3) {
      Alert.alert('Missing Types', 'Please select at least 3 pod types');
      return;
    }

    if (locationTypes.length === 0) {
      Alert.alert('Missing Location', 'Please select at least one location type (In-person, Hybrid, or Remote)');
      return;
    }

    const requiresLocation = locationTypes.includes('In-person') || locationTypes.includes('Hybrid');
    if (requiresLocation && !locationCity.trim()) {
      Alert.alert('Missing City', 'Please select a city');
      return;
    }
    if (requiresLocation && !locationState.trim()) {
      Alert.alert('Missing State', 'Please select a state');
      return;
    }

    // Meeting address and pin location are optional for in-person pods

    let locationString = '';
    const cityStateString = `${locationCity}, ${locationState}`;

    if (locationTypes.includes('Remote') && locationTypes.length === 1) {
      locationString = 'Remote';
    } else if (locationTypes.includes('In-person') && !locationTypes.includes('Hybrid') && !locationTypes.includes('Remote')) {
      locationString = cityStateString;
    } else if (locationTypes.includes('Hybrid') && !locationTypes.includes('In-person') && !locationTypes.includes('Remote')) {
      locationString = `Hybrid - ${cityStateString}`;
    } else {
      const parts: string[] = [];
      if (locationTypes.includes('Remote')) parts.push('Remote');
      if (locationTypes.includes('In-person')) parts.push(cityStateString);
      if (locationTypes.includes('Hybrid')) parts.push(`Hybrid - ${cityStateString}`);
      locationString = parts.join(', ');
    }

    setLoading(true);
    try {
      await pursuitService.createPursuit({
        creator_id: user?.id,
        title,
        description,
        team_size_min: parseInt(teamSizeMin) || 2,
        team_size_max: parseInt(teamSizeMax) || 8,
        team_size_flexible: teamSizeFlexible,
        location: locationString,
        neighborhood: neighborhood || null,
        address: address || null,
        latitude: pinLatitude,
        longitude: pinLongitude,
        projected_duration: projectedDuration || null,
        pursuit_types: selectedTypes,
        pursuit_categories: categories ? categories.split(',').map(c => c.trim()) : [],
        ownership_structure: ownershipStructure || null,
        decision_system: decisionSystem.toLowerCase().replace(/ /g, '_'),
        decision_system_note: decisionNote || null,
        meeting_cadence: meetingCadence,
        meeting_cadence_note: meetingNote || null,
        attendance_style: attendanceStyle,
        attendance_note: attendanceNote || null,
        accountability_mechanics: accountabilityMechanics ? accountabilityMechanics.split(',').map(m => m.trim()) : null,
        roles: roles ? roles.split(',').map(r => r.trim()) : null,
        experience_level: experienceLevel || null,
        current_stage: currentStage || null,
        age_restriction: ageRestriction || null,
        continue_accepting_after_kickoff: continueAccepting,
        is_open_pod: isOpenPod,
        requires_interview: isOpenPod ? false : requiresInterview,
        requires_resume: isOpenPod ? false : (resumeMode !== 'off'),
        resume_mode: isOpenPod ? 'off' : resumeMode,
        portfolio_mode: isOpenPod ? 'off' : portfolioMode,
        application_questions: isOpenPod ? null : (() => {
          const custom = applicationQuestions.filter(q => q.trim());
          const defaults = includeDefaultQuestions
            ? ['Why are you a good team fit?', 'Where do you hope to see this go?']
            : [];
          const all = [...defaults, ...custom];
          return all.length > 0 ? all : null;
        })(),
        status: 'awaiting_kickoff',
        current_members_count: 1,
      });

      Alert.alert('Success!', 'Your pod has been created!', [
        { text: 'OK', onPress: () => {
          setTitle('');
          setDescription('');
          setTeamSizeMin('2');
          setTeamSizeMax('8');
          setTeamSizeFlexible(false);
          setLocationTypes([]);
          setLocationCity('');
          setLocationState('');
          setCitySearchQuery('');
          setShowCitySuggestions(false);
          setNeighborhood('');
          setNeighborhoodSearch('');
          setShowNeighborhoodSuggestions(false);
          setAddress('');
          setPinLatitude(null);
          setPinLongitude(null);
          setProjectedDuration('');
          setSelectedTypes([]);
          setCategories('');
          setOwnershipStructure('');
          setDecisionSystem('Standard Vote');
          setDecisionNote('');
          setMeetingCadence('');
          setMeetingNote('');
          setAttendanceStyle('Mandatory');
          setAttendanceNote('');
          setAccountabilityMechanics('');
          setRoles('');
          setExperienceLevel('');
          setCurrentStage('');
          setAgeRestriction('');
          setContinueAccepting(false);
          setRequiresInterview(false);
          setRequiresResume(false);
          setResumeMode('off');
          setPortfolioMode('off');
          setApplicationQuestions(['']);
          setCurrentPage(0);
          scrollViewRef.current?.scrollTo({ x: 0, animated: false });
          onClose?.();
        }}
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  // ===== NAVIGATION =====

  const goToPage = (page: number) => {
    scrollViewRef.current?.scrollTo({ x: page * SCREEN_WIDTH, animated: true });
    setCurrentPage(page);
  };

  const canProceedPage = (page: number): boolean => {
    switch (page) {
      case 0:
        return title.trim().length > 0 && description.length >= 50 && selectedTypes.length >= 3;
      case 1:
        if (locationTypes.length === 0) return false;
        const requiresLoc = locationTypes.includes('In-person') || locationTypes.includes('Hybrid');
        if (requiresLoc && (!locationCity.trim() || !locationState.trim())) return false;
        // Meeting address and pin location are optional
        return true;
      case 2:
        return meetingCadence.trim().length > 0;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentPage < TOTAL_PAGES - 1 && canProceedPage(currentPage)) {
      goToPage(currentPage + 1);
    }
  };

  const handleBack = () => {
    if (currentPage > 0) {
      goToPage(currentPage - 1);
    }
  };

  // ===== SECTION TITLES & LABELS =====

  const getSectionTitle = (page: number): string => {
    switch (page) {
      case 0: return 'The Basics';
      case 1: return 'Details';
      case 2: return 'Structure';
      default: return '';
    }
  };

  const getStepLabel = (page: number): string => {
    switch (page) {
      case 0: return 'Name it, describe it, categorize it';
      case 1: return 'Size, location, and decisions';
      case 2: return 'Meetings, roles, and applications';
      default: return '';
    }
  };

  // ===== SHARED UI COMPONENTS =====

  const renderProgressDots = () => (
    <View style={styles.progressDots}>
      {Array.from({ length: TOTAL_PAGES }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === currentPage && styles.dotActive,
            i < currentPage && styles.dotCompleted,
          ]}
        />
      ))}
    </View>
  );

  const renderStepHeader = (page: number) => (
    <View style={styles.headerArea}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>{getSectionTitle(page)}</Text>
        {renderProgressDots()}
      </View>
      <View style={styles.accentLine} />
      {getStepLabel(page) ? (
        <Text style={styles.stepLabel}>{getStepLabel(page)}</Text>
      ) : null}
    </View>
  );

  const renderBottomNav = (page: number) => (
    <View style={styles.bottomNav}>
      {page > 0 ? (
        <TouchableOpacity onPress={handleBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={28} color={C.ink} />
        </TouchableOpacity>
      ) : (
        <View style={{ width: 28 }} />
      )}

      {page < TOTAL_PAGES - 1 ? (
        <TouchableOpacity
          style={[
            styles.forwardButton,
            !canProceedPage(page) && { opacity: 0.3 },
          ]}
          onPress={handleNext}
          disabled={!canProceedPage(page)}
        >
          <Ionicons name="chevron-forward" size={24} color={C.white} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[
            styles.createButton,
            (!canProceedPage(page) || loading) && { opacity: 0.3 },
          ]}
          onPress={handleCreate}
          disabled={!canProceedPage(page) || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={C.white} />
          ) : (
            <Text style={styles.createButtonText}>Create Pod</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  // ===== FIELD LABEL HELPER =====

  const renderFieldLabel = (label: string, required?: boolean) => (
    <Text style={styles.fieldLabel}>
      {label}{required ? ' *' : ''}
    </Text>
  );

  const renderHint = (text: string) => (
    <Text style={styles.hintText}>{text}</Text>
  );

  // ===== CHIP SELECTOR HELPER =====

  const renderChip = (label: string, isSelected: boolean, onPress: () => void) => (
    <TouchableOpacity
      key={label}
      style={[styles.chip, isSelected && styles.chipActive]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  // ===== PAGE 1: THE BASICS =====

  const renderPage1 = () => (
    <View style={[styles.pageContainer, { width: SCREEN_WIDTH }]}>
      <View style={styles.pageInner}>
        {renderStepHeader(0)}
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          {/* Title */}
          {renderFieldLabel('Title', true)}
          <TextInput
            style={styles.underlineInput}
            placeholder="e.g., Learn Java Programming Together"
            placeholderTextColor={C.border}
            value={title}
            onChangeText={setTitle}
          />

          {/* Description */}
          {renderFieldLabel('Description', true)}
          <Text style={styles.charCount}>{description.length}/50 min</Text>
          <TextInput
            style={styles.textAreaInput}
            placeholder="Describe your pod, who you're looking for, and what you're pursuing. Be specific!"
            placeholderTextColor={C.border}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />

          {/* Pod Type */}
          {renderFieldLabel('Pod Type', true)}
          {renderHint(`Selected: ${selectedTypes.length}/5`)}

          {selectedTypes.length > 0 && (
            <View style={styles.selectedTypesContainer}>
              {selectedTypes.map((type) => (
                <View key={type} style={styles.selectedTypeChip}>
                  <Text style={styles.selectedTypeText}>{type}</Text>
                  <TouchableOpacity onPress={() => setSelectedTypes(selectedTypes.filter(t => t !== type))}>
                    <Ionicons name="close-circle" size={18} color={C.white} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setShowPursuitTypeModal(true)}
          >
            <Text style={styles.dropdownButtonText}>
              {selectedTypes.length === 0 ? 'Select pod types...' : 'Add more types...'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={C.muted} />
          </TouchableOpacity>

          {/* Categories */}
          {renderFieldLabel('Categories (optional, up to 5)')}
          {renderHint('Comma-separated (e.g., tech, basketball, pokemon)')}
          <TextInput
            style={styles.underlineInput}
            placeholder="tech, basketball, pokemon"
            placeholderTextColor={C.border}
            value={categories}
            onChangeText={setCategories}
          />
        </ScrollView>
        {renderBottomNav(0)}
      </View>
    </View>
  );

  // ===== PAGE 2: DETAILS =====

  const renderPage2 = () => (
    <View style={[styles.pageContainer, { width: SCREEN_WIDTH }]}>
      <View style={styles.pageInner}>
        {renderStepHeader(1)}
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          {/* Team Size Range */}
          {renderFieldLabel('Team Size Range')}
          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={styles.miniLabel}>Min</Text>
              <TextInput
                style={styles.underlineInput}
                placeholder="2"
                placeholderTextColor={C.border}
                value={teamSizeMin}
                onChangeText={setTeamSizeMin}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.miniLabel}>Max</Text>
              <TextInput
                style={styles.underlineInput}
                placeholder="8"
                placeholderTextColor={C.border}
                value={teamSizeMax}
                onChangeText={setTeamSizeMax}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Team size flexible?</Text>
            <Switch
              value={teamSizeFlexible}
              onValueChange={setTeamSizeFlexible}
              trackColor={{ false: C.border, true: C.accentLine }}
              thumbColor={teamSizeFlexible ? C.accent : C.white}
            />
          </View>

          {/* Location Type */}
          {renderFieldLabel('Location Type', true)}
          {renderHint('Select all that apply')}
          <View style={styles.chipContainer}>
            {['In-person', 'Hybrid', 'Remote'].map((type) =>
              renderChip(type, locationTypes.includes(type), () => toggleLocationType(type))
            )}
          </View>

          {/* Conditional Location Fields */}
          {(locationTypes.includes('In-person') || locationTypes.includes('Hybrid')) && (
            <>
              {/* City */}
              {renderFieldLabel('City', true)}
              {renderHint(
                locationState
                  ? `Start typing to search cities in ${locationState}`
                  : 'Start typing to search cities'
              )}
              <View style={{ zIndex: 1000 }}>
                <TextInput
                  style={styles.underlineInput}
                  placeholder="Search city (e.g., Austin)"
                  placeholderTextColor={C.border}
                  value={citySearchQuery}
                  onChangeText={handleCitySearch}
                  autoCapitalize="words"
                />
                {showCitySuggestions && filteredCities.length > 0 && (
                  <View style={styles.suggestionsContainer}>
                    <ScrollView style={styles.suggestionsList} keyboardShouldPersistTaps="handled">
                      {filteredCities.map((city, index) => (
                        <TouchableOpacity
                          key={index}
                          style={styles.suggestionItem}
                          onPress={() => selectCity(city)}
                        >
                          <Text style={styles.suggestionText}>{city}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* State */}
              {renderFieldLabel('State', true)}
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => {
                  Keyboard.dismiss();
                  setShowStateModal(true);
                }}
              >
                <Text style={locationState ? styles.pickerButtonTextSelected : styles.pickerButtonText}>
                  {locationState || 'Select state'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={C.muted} />
              </TouchableOpacity>

              {/* Neighborhood */}
              {availableNeighborhoods.length > 0 && (
                <>
                  {renderFieldLabel('Neighborhood (optional)')}
                  {renderHint(`Search neighborhoods in ${locationCity}`)}
                  <View style={{ zIndex: 999 }}>
                    <TextInput
                      style={styles.underlineInput}
                      placeholder={`e.g., ${availableNeighborhoods[0] || 'Downtown'}`}
                      placeholderTextColor={C.border}
                      value={neighborhoodSearch}
                      onChangeText={handleNeighborhoodSearch}
                      autoCapitalize="words"
                    />
                    {showNeighborhoodSuggestions && filteredNeighborhoods.length > 0 && (
                      <View style={styles.suggestionsContainer}>
                        <ScrollView style={styles.suggestionsList} keyboardShouldPersistTaps="handled">
                          {filteredNeighborhoods.map((hood, index) => (
                            <TouchableOpacity
                              key={index}
                              style={styles.suggestionItem}
                              onPress={() => selectNeighborhood(hood)}
                            >
                              <Text style={styles.suggestionText}>{hood}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                </>
              )}

              {/* Address & Map (In-person only) */}
              {locationTypes.includes('In-person') && (
                <>
                  {renderFieldLabel('Meeting Address')}
                  <TextInput
                    style={styles.underlineInput}
                    placeholder="e.g., 123 Main St"
                    placeholderTextColor={C.border}
                    value={address}
                    onChangeText={setAddress}
                    onBlur={geocodeAddress}
                    returnKeyType="done"
                    onSubmitEditing={geocodeAddress}
                  />

                  {renderFieldLabel('Pin the meeting location')}
                  {renderHint(geocoding ? 'Looking up address...' : pinLatitude != null ? 'Pin placed automatically — tap map to adjust' : 'Enter an address above or tap the map')}
                  <LocationMapView
                    latitude={pinLatitude}
                    longitude={pinLongitude}
                    interactive={true}
                    initialCity={locationCity}
                    onLocationSelect={(lat, lng) => {
                      setPinLatitude(lat);
                      setPinLongitude(lng);
                    }}
                    style={{ marginBottom: 8 }}
                  />
                  {pinLatitude != null && pinLongitude != null && (
                    <Text style={[styles.hintText, { color: C.accent }]}>
                      Location pinned
                    </Text>
                  )}
                </>
              )}
            </>
          )}

          {/* Decision System */}
          {renderFieldLabel('Decision System')}
          <View style={styles.chipContainer}>
            {DECISION_SYSTEMS.map((system) =>
              renderChip(system, decisionSystem === system, () => setDecisionSystem(system))
            )}
          </View>
          <TextInput
            style={styles.underlineInput}
            placeholder="Add a note about your decision system (optional)"
            placeholderTextColor={C.border}
            value={decisionNote}
            onChangeText={setDecisionNote}
          />
        </ScrollView>
        {renderBottomNav(1)}
      </View>
    </View>
  );

  // ===== PAGE 3: STRUCTURE =====

  const renderPage3 = () => (
    <View style={[styles.pageContainer, { width: SCREEN_WIDTH }]}>
      <View style={styles.pageInner}>
        {renderStepHeader(2)}
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* Meeting Cadence */}
          {renderFieldLabel('Meeting Cadence', true)}
          <TextInput
            style={styles.underlineInput}
            placeholder="e.g., Weekly on Mondays at 7pm"
            placeholderTextColor={C.border}
            value={meetingCadence}
            onChangeText={setMeetingCadence}
          />
          <TextInput
            style={styles.underlineInput}
            placeholder="Add a note (optional)"
            placeholderTextColor={C.border}
            value={meetingNote}
            onChangeText={setMeetingNote}
          />

          {/* Attendance Style */}
          {renderFieldLabel('Attendance Style')}
          <View style={styles.chipContainer}>
            {ATTENDANCE_STYLES.map((style) =>
              renderChip(style, attendanceStyle === style, () => setAttendanceStyle(style))
            )}
          </View>
          <TextInput
            style={styles.underlineInput}
            placeholder="Set expectations for attendance (optional)"
            placeholderTextColor={C.border}
            value={attendanceNote}
            onChangeText={setAttendanceNote}
          />

          {/* Roles */}
          {renderFieldLabel('Roles (optional)')}
          {renderHint('Comma-separated roles you\'re looking for')}
          <TextInput
            style={styles.underlineInput}
            placeholder="Developer, Designer, Marketing Lead"
            placeholderTextColor={C.border}
            value={roles}
            onChangeText={setRoles}
          />

          {/* Experience Level */}
          {renderFieldLabel('Experience Level (optional)')}
          <TextInput
            style={styles.underlineInput}
            placeholder="e.g., 5+ years, Beginner, Intermediate"
            placeholderTextColor={C.border}
            value={experienceLevel}
            onChangeText={setExperienceLevel}
          />

          {/* Projected Duration */}
          {renderFieldLabel('Projected Duration (optional)')}
          <TextInput
            style={styles.underlineInput}
            placeholder="e.g., 3 months, 1 year, ongoing"
            placeholderTextColor={C.border}
            value={projectedDuration}
            onChangeText={setProjectedDuration}
          />

          {/* Age Restriction */}
          {renderFieldLabel('Age Restriction (optional)')}
          <TextInput
            style={styles.underlineInput}
            placeholder="e.g., 18+, 21+ for cocktails, Students only"
            placeholderTextColor={C.border}
            value={ageRestriction}
            onChangeText={setAgeRestriction}
          />

          {/* Application Settings */}
          <Text style={styles.subSectionTitle}>Application Settings</Text>

          {/* Open Pod toggle — bypasses entire application flow */}
          <View style={[styles.switchRow, { backgroundColor: isOpenPod ? 'rgba(134, 239, 172, 0.12)' : 'transparent', borderRadius: 10, paddingHorizontal: isOpenPod ? 12 : 0, paddingVertical: isOpenPod ? 10 : 0 }]}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.switchLabel}>Open pod — anyone can join instantly</Text>
              <Text style={[styles.switchLabel, { fontSize: 12, opacity: 0.7, marginTop: 2 }]}>
                Skips applications, interviews, resumes, and custom questions. Members are auto-accepted on tap.
              </Text>
            </View>
            <Switch
              value={isOpenPod}
              onValueChange={setIsOpenPod}
              trackColor={{ false: C.border, true: C.accentLine }}
              thumbColor={isOpenPod ? C.accent : C.white}
            />
          </View>

          {!isOpenPod && (
            <>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Continue accepting after kickoff?</Text>
                <Switch
                  value={continueAccepting}
                  onValueChange={setContinueAccepting}
                  trackColor={{ false: C.border, true: C.accentLine }}
                  thumbColor={continueAccepting ? C.accent : C.white}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Include interview option?</Text>
                <Switch
                  value={requiresInterview}
                  onValueChange={setRequiresInterview}
                  trackColor={{ false: C.border, true: C.accentLine }}
                  thumbColor={requiresInterview ? C.accent : C.white}
                />
              </View>

              {/* Resume */}
              <View style={styles.requirementBlock}>
                <Text style={styles.requirementLabel}>Resume</Text>
                <View style={styles.requirementChips}>
                  {(['off', 'optional', 'mandatory'] as const).map(mode => (
                    <TouchableOpacity
                      key={mode}
                      style={[
                        styles.requirementChip,
                        resumeMode === mode && styles.requirementChipActive,
                      ]}
                      onPress={() => setResumeMode(mode)}
                    >
                      <Text style={[
                        styles.requirementChipText,
                        resumeMode === mode && styles.requirementChipTextActive,
                      ]}>
                        {mode === 'off' ? "Don't ask" : mode === 'optional' ? 'Optional' : 'Mandatory'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Portfolio */}
              <View style={styles.requirementBlock}>
                <Text style={styles.requirementLabel}>Portfolio</Text>
                <View style={styles.requirementChips}>
                  {(['off', 'optional', 'mandatory'] as const).map(mode => (
                    <TouchableOpacity
                      key={mode}
                      style={[
                        styles.requirementChip,
                        portfolioMode === mode && styles.requirementChipActive,
                      ]}
                      onPress={() => setPortfolioMode(mode)}
                    >
                      <Text style={[
                        styles.requirementChipText,
                        portfolioMode === mode && styles.requirementChipTextActive,
                      ]}>
                        {mode === 'off' ? "Don't ask" : mode === 'optional' ? 'Optional' : 'Mandatory'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}

          {/* Application Questions */}
          {!isOpenPod && (
          <View style={styles.questionsSection}>
            <Text style={styles.questionsSectionTitle}>Application Questions</Text>
            <Text style={styles.questionsSectionSubtitle}>
              Add up to 10 custom questions for applicants
            </Text>

            <View style={styles.defaultQuestionsBox}>
              <View style={styles.defaultQuestionsToggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.defaultQuestionsLabel}>Include default questions</Text>
                </View>
                <Switch
                  value={includeDefaultQuestions}
                  onValueChange={setIncludeDefaultQuestions}
                  trackColor={{ false: C.border, true: C.accent }}
                  thumbColor={C.white}
                />
              </View>
              {includeDefaultQuestions && (
                <View style={{ marginTop: 8 }}>
                  <Text style={styles.defaultQuestion}>1. Why are you a good team fit?</Text>
                  <Text style={styles.defaultQuestion}>2. Where do you hope to see this go?</Text>
                </View>
              )}
            </View>

            <Text style={styles.customizeHint}>
              Add your own custom questions below:
            </Text>

            {applicationQuestions.map((question, index) => (
              <View key={index} style={styles.questionInputRow}>
                <View style={styles.questionNumber}>
                  <Text style={styles.questionNumberText}>{index + 1}</Text>
                </View>
                <TextInput
                  style={styles.questionInput}
                  placeholder={index === 0 ? "e.g., What relevant experience do you have?" : "Enter your question..."}
                  placeholderTextColor={C.border}
                  value={question}
                  onChangeText={(text) => {
                    const newQuestions = [...applicationQuestions];
                    newQuestions[index] = text;
                    setApplicationQuestions(newQuestions);
                  }}
                  multiline
                />
                {applicationQuestions.length > 1 && (
                  <TouchableOpacity
                    style={styles.removeQuestionBtn}
                    onPress={() => {
                      const newQuestions = applicationQuestions.filter((_, i) => i !== index);
                      setApplicationQuestions(newQuestions);
                    }}
                  >
                    <Ionicons name="close" size={16} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {applicationQuestions.length < 10 && (
              <TouchableOpacity
                style={styles.addQuestionBtn}
                onPress={() => setApplicationQuestions([...applicationQuestions, ''])}
              >
                <Ionicons name="add-circle-outline" size={20} color={C.accent} />
                <Text style={styles.addQuestionText}>Add Question</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.questionsCounter}>
              {applicationQuestions.filter(q => q.trim()).length} of 10 questions used
            </Text>
          </View>
          )}
        </ScrollView>
        {renderBottomNav(2)}
      </View>
    </View>
  );

  // ===== MAIN RENDER =====

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient
        colors={[C.gradientTop, C.bg]}
        style={styles.topGradient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Top bar with close button and title */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="close" size={26} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.mainTitle}>Create a Pod</Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
        >
          {renderPage1()}
          {renderPage2()}
          {renderPage3()}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* State Picker Modal */}
      <Modal
        visible={showStateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Select State{locationCity ? ` (for ${locationCity})` : ''}
              </Text>
              <TouchableOpacity onPress={() => setShowStateModal(false)}>
                <Ionicons name="close" size={24} color={C.ink} />
              </TouchableOpacity>
            </View>
            {locationState ? (
              <TouchableOpacity style={styles.clearButton} onPress={clearState}>
                <Text style={styles.clearButtonText}>Clear selection ({locationState})</Text>
              </TouchableOpacity>
            ) : null}
            {filteredStates.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <Text style={styles.emptyStateText}>No states found for the selected city</Text>
              </View>
            ) : (
              <FlatList
                data={filteredStates}
                keyExtractor={(item) => item.abbr}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.stateItem, locationState === item.abbr && styles.stateItemSelected]}
                    onPress={() => selectState(item.abbr)}
                  >
                    <Text style={[styles.stateText, locationState === item.abbr && styles.stateTextSelected]}>
                      {item.name} ({item.abbr}){locationState === item.abbr ? ' (tap to deselect)' : ''}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Pod Type Picker Modal */}
      <Modal
        visible={showPursuitTypeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPursuitTypeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Pod Types</Text>
              <TouchableOpacity onPress={() => {
                setShowPursuitTypeModal(false);
                setPursuitTypeSearch('');
              }}>
                <Ionicons name="close" size={24} color={C.ink} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={C.muted} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search pod types..."
                placeholderTextColor={C.muted}
                value={pursuitTypeSearch}
                onChangeText={setPursuitTypeSearch}
                autoCapitalize="none"
              />
              {pursuitTypeSearch.length > 0 && (
                <TouchableOpacity onPress={() => setPursuitTypeSearch('')}>
                  <Ionicons name="close-circle" size={20} color={C.muted} />
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.selectedCount}>
              {selectedTypes.length}/5 selected
              {selectedTypes.length >= 5 && ' (max reached)'}
            </Text>

            <FlatList
              data={PURSUIT_TYPES.filter(type =>
                type.toLowerCase().includes(pursuitTypeSearch.toLowerCase())
              )}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const isSelected = selectedTypes.includes(item);
                const isDisabled = !isSelected && selectedTypes.length >= 5;
                return (
                  <TouchableOpacity
                    style={[
                      styles.pursuitTypeItem,
                      isSelected && styles.pursuitTypeItemSelected,
                      isDisabled && styles.pursuitTypeItemDisabled,
                    ]}
                    onPress={() => {
                      if (isSelected) {
                        setSelectedTypes(selectedTypes.filter(t => t !== item));
                      } else if (selectedTypes.length < 5) {
                        setSelectedTypes([...selectedTypes, item]);
                      }
                    }}
                    disabled={isDisabled}
                  >
                    <Text style={[
                      styles.pursuitTypeText,
                      isSelected && styles.pursuitTypeTextSelected,
                      isDisabled && styles.pursuitTypeTextDisabled,
                    ]}>
                      {item}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={22} color={C.accent} />
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyStateContainer}>
                  <Text style={styles.emptyStateText}>No matching pod types</Text>
                </View>
              }
            />

            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => {
                setShowPursuitTypeModal(false);
                setPursuitTypeSearch('');
              }}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 220,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 8,
    zIndex: 10,
  },
  mainTitle: {
    fontFamily: F.title,
    fontSize: 24,
    color: C.accent,
  },

  // Page layout
  pageContainer: {
    flex: 1,
  },
  pageInner: {
    flex: 1,
    paddingTop: 8,
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
  },

  // Header area (matching onboarding)
  headerArea: {
    marginBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: F.header,
    fontSize: 22,
    color: C.ink,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.border,
  },
  dotActive: {
    backgroundColor: C.ink,
    width: 20,
    borderRadius: 4,
  },
  dotCompleted: {
    backgroundColor: C.ink,
  },
  accentLine: {
    height: 2,
    backgroundColor: C.accentLine,
    marginBottom: 16,
  },
  stepLabel: {
    fontFamily: F.body,
    fontSize: 14,
    color: C.muted,
    letterSpacing: 0.3,
  },

  // Bottom navigation (matching onboarding)
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 4,
  },
  forwardButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.ink,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButton: {
    height: 56,
    paddingHorizontal: 28,
    borderRadius: 28,
    backgroundColor: C.ink,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButtonText: {
    fontFamily: F.bodyMedium,
    fontSize: 16,
    color: C.white,
  },

  // Form fields
  fieldLabel: {
    fontFamily: F.bodyMedium,
    fontSize: 14,
    color: C.ink,
    marginTop: 20,
    marginBottom: 8,
  },
  miniLabel: {
    fontFamily: F.body,
    fontSize: 12,
    color: C.muted,
    marginBottom: 4,
  },
  hintText: {
    fontFamily: F.body,
    fontSize: 12,
    color: C.muted,
    marginBottom: 8,
  },
  charCount: {
    fontFamily: F.body,
    fontSize: 12,
    color: C.muted,
    textAlign: 'right',
    marginBottom: 4,
  },
  underlineInput: {
    fontFamily: F.body,
    fontSize: 16,
    color: C.ink,
    borderBottomWidth: 1.5,
    borderBottomColor: C.border,
    paddingVertical: 10,
    marginBottom: 4,
  },
  textAreaInput: {
    fontFamily: F.body,
    fontSize: 16,
    color: C.ink,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    padding: 12,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 4,
  },

  // Chips
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.white,
  },
  chipActive: {
    borderColor: C.ink,
    backgroundColor: C.ink,
  },
  chipText: {
    fontFamily: F.body,
    fontSize: 14,
    color: C.ink,
  },
  chipTextActive: {
    color: C.white,
    fontFamily: F.bodyMedium,
  },

  // Selected types
  selectedTypesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  selectedTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  selectedTypeText: {
    color: C.white,
    fontSize: 13,
    fontFamily: F.bodyMedium,
  },

  // Dropdown button
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    padding: 14,
    backgroundColor: C.white,
  },
  dropdownButtonText: {
    fontFamily: F.body,
    fontSize: 14,
    color: C.muted,
  },

  // Row layout
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  halfInput: {
    flex: 1,
  },

  // Switch row
  requirementBlock: {
    marginVertical: 12,
  },
  requirementLabel: {
    fontFamily: F.bodyMedium,
    fontSize: 14,
    color: C.ink,
    marginBottom: 10,
  },
  requirementChips: {
    flexDirection: 'row',
    gap: 8,
  },
  requirementChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  requirementChipActive: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  requirementChipText: {
    fontFamily: F.body,
    fontSize: 13,
    color: C.muted,
  },
  requirementChipTextActive: {
    color: C.white,
    fontFamily: F.bodyMedium,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  switchLabel: {
    fontFamily: F.body,
    fontSize: 14,
    color: C.ink,
    flex: 1,
    marginRight: 12,
  },

  // Sub section title
  subSectionTitle: {
    fontFamily: F.header,
    fontSize: 18,
    color: C.ink,
    marginTop: 28,
    marginBottom: 12,
  },

  // Suggestions
  suggestionsContainer: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    maxHeight: 200,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  suggestionText: {
    fontFamily: F.body,
    fontSize: 15,
    color: C.ink,
  },

  // Picker button
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: C.border,
    paddingVertical: 12,
    marginBottom: 4,
  },
  pickerButtonText: {
    fontFamily: F.body,
    fontSize: 16,
    color: C.muted,
  },
  pickerButtonTextSelected: {
    fontFamily: F.body,
    fontSize: 16,
    color: C.ink,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  modalTitle: {
    fontFamily: F.header,
    fontSize: 18,
    color: C.ink,
  },

  // State modal items
  stateItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  stateItemSelected: {
    backgroundColor: '#F0F5EC',
  },
  stateText: {
    fontFamily: F.body,
    fontSize: 15,
    color: C.ink,
  },
  stateTextSelected: {
    color: C.accent,
    fontFamily: F.bodyMedium,
  },
  clearButton: {
    backgroundColor: '#fee2e2',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#dc2626',
    fontSize: 14,
    fontFamily: F.bodyMedium,
  },
  emptyStateContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontFamily: F.body,
    fontSize: 14,
    color: C.muted,
    textAlign: 'center',
  },

  // Pursuit type modal
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderRadius: 10,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontFamily: F.body,
    fontSize: 14,
    color: C.ink,
  },
  selectedCount: {
    fontFamily: F.body,
    fontSize: 12,
    color: C.muted,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  pursuitTypeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  pursuitTypeItemSelected: {
    backgroundColor: '#F0F5EC',
  },
  pursuitTypeItemDisabled: {
    opacity: 0.5,
  },
  pursuitTypeText: {
    fontFamily: F.body,
    fontSize: 15,
    color: C.ink,
  },
  pursuitTypeTextSelected: {
    color: C.accent,
    fontFamily: F.bodyMedium,
  },
  pursuitTypeTextDisabled: {
    color: C.muted,
  },
  doneButton: {
    backgroundColor: C.ink,
    margin: 16,
    padding: 14,
    borderRadius: 28,
    alignItems: 'center',
  },
  doneButtonText: {
    color: C.white,
    fontSize: 16,
    fontFamily: F.bodyMedium,
  },

  // Questions section
  questionsSection: {
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  questionsSectionTitle: {
    fontFamily: F.header,
    fontSize: 16,
    color: C.ink,
    marginBottom: 4,
  },
  questionsSectionSubtitle: {
    fontFamily: F.body,
    fontSize: 13,
    color: C.muted,
    marginBottom: 12,
  },
  defaultQuestionsBox: {
    backgroundColor: C.bg,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  defaultQuestionsToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  defaultQuestionsLabel: {
    fontFamily: F.bodyMedium,
    fontSize: 11,
    color: C.muted,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  defaultQuestion: {
    fontFamily: F.body,
    fontSize: 14,
    color: C.ink,
    marginBottom: 4,
    lineHeight: 20,
  },
  customizeHint: {
    fontFamily: F.bodyMedium,
    fontSize: 13,
    color: C.accent,
    marginBottom: 12,
  },
  questionInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 8,
  },
  questionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F0F5EC',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  questionNumberText: {
    fontFamily: F.bodyMedium,
    fontSize: 12,
    color: C.accent,
  },
  questionInput: {
    flex: 1,
    fontFamily: F.body,
    fontSize: 15,
    color: C.ink,
    backgroundColor: C.bg,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 44,
  },
  removeQuestionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  addQuestionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F0F5EC',
    borderRadius: 8,
    marginTop: 4,
    gap: 6,
    borderWidth: 1,
    borderColor: C.accent,
    borderStyle: 'dashed',
  },
  addQuestionText: {
    fontFamily: F.bodyMedium,
    fontSize: 14,
    color: C.accent,
  },
  questionsCounter: {
    fontFamily: F.body,
    fontSize: 12,
    color: C.muted,
    textAlign: 'right',
    marginTop: 8,
  },
});
