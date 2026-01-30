import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Switch, Modal, FlatList, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFonts, NothingYouCouldDo_400Regular } from '@expo-google-fonts/nothing-you-could-do';
import { useAuth } from '../contexts/AuthContext';
import { pursuitService } from '../services/pursuitService';
import { colors as legacyColors, typography, spacing } from '../theme/designSystem';
import { useTheme } from '../theme/ThemeContext';
import { getThemedStyles } from '../theme/themedStyles';
import GrainTexture from '../components/ui/GrainTexture';

const PURSUIT_TYPES = [
  'Accountability', 'Art', 'Business', 'Career Development', 'Co-founders', 'Discussion',
  'Education', 'Explore', 'Fitness', 'Friends', 'Fun', 'Games', 'Hangout', 'Health',
  'Hobby', 'Lifestyle', 'Medical', 'Mental Health', 'Music', 'Nature', 'Networking',
  'New Endeavor', 'Personal Growth', 'Problem', 'Relax', 'Religion', 'Side Hustle',
  'Social Media', 'Socialize', 'Spiritual', 'Sport', 'Support', 'Technology', 'Travel'
].sort();
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
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;
  const themedStyles = getThemedStyles(colors, isNewTheme);

  const [fontsLoaded] = useFonts({
    NothingYouCouldDo_400Regular,
  });

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
  const [applicationQuestions, setApplicationQuestions] = useState('');

  const [loading, setLoading] = useState(false);

  const toggleType = (type: string) => {
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter(t => t !== type));
    } else if (selectedTypes.length < 3) {
      setSelectedTypes([...selectedTypes, type]);
    } else {
      Alert.alert('Limit Reached', 'You can select up to 3 pursuit types');
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

    // If this city only exists in one state, auto-select that state
    const statesForCity = CITY_STATE_MAP[city];
    if (statesForCity && statesForCity.length === 1) {
      setLocationState(statesForCity[0]);
    } else if (statesForCity && locationState && !statesForCity.includes(locationState)) {
      // If current state is not valid for this city, clear it
      setLocationState('');
    }
  };

  const selectState = (stateAbbr: string) => {
    // If tapping the same state, deselect it
    if (locationState === stateAbbr) {
      setLocationState('');
      setShowStateModal(false);
      return;
    }

    setLocationState(stateAbbr);
    setShowStateModal(false);

    // If current city doesn't exist in this state, clear it
    if (locationCity && CITY_STATE_MAP[locationCity] && !CITY_STATE_MAP[locationCity].includes(stateAbbr)) {
      setLocationCity('');
      setCitySearchQuery('');
    }
  };

  const clearState = () => {
    setLocationState('');
    setShowStateModal(false);
  };

  // Filter cities based on search query AND selected state (if any)
  const filteredCities = US_CITIES.filter(city => {
    const matchesSearch = city.toLowerCase().startsWith(citySearchQuery.toLowerCase());
    if (!matchesSearch) return false;

    // If a state is selected, only show cities in that state
    if (locationState) {
      const statesForCity = CITY_STATE_MAP[city];
      return statesForCity && statesForCity.includes(locationState);
    }
    return true;
  }).slice(0, 10);

  // Filter states based on selected city (if any)
  const filteredStates = US_STATES.filter(state => {
    // If a city is selected, only show states where that city exists
    if (locationCity && CITY_STATE_MAP[locationCity]) {
      return CITY_STATE_MAP[locationCity].includes(state.abbr);
    }
    return true;
  });

  const handleCreate = async () => {
    // Validation
    if (!title || !description || !meetingCadence) {
      Alert.alert('Missing Fields', 'Please fill in all required fields (marked with *)');
      return;
    }

    if (description.length < 50) {
      Alert.alert('Description Too Short', 'Description must be at least 50 characters');
      return;
    }

    if (selectedTypes.length === 0) {
      Alert.alert('Missing Type', 'Please select at least one pursuit type');
      return;
    }

    // Location validation
    if (locationTypes.length === 0) {
      Alert.alert('Missing Location', 'Please select at least one location type (In-person, Hybrid, or Remote)');
      return;
    }

    // Check if city and state are required (in-person or hybrid selected)
    const requiresLocation = locationTypes.includes('In-person') || locationTypes.includes('Hybrid');
    if (requiresLocation && !locationCity.trim()) {
      Alert.alert('Missing City', 'Please select a city');
      return;
    }
    if (requiresLocation && !locationState.trim()) {
      Alert.alert('Missing State', 'Please select a state');
      return;
    }

    // Build location string
    let locationString = '';
    const cityStateString = `${locationCity}, ${locationState}`;

    if (locationTypes.includes('Remote') && locationTypes.length === 1) {
      locationString = 'Remote';
    } else if (locationTypes.includes('In-person') && !locationTypes.includes('Hybrid') && !locationTypes.includes('Remote')) {
      locationString = cityStateString;
    } else if (locationTypes.includes('Hybrid') && !locationTypes.includes('In-person') && !locationTypes.includes('Remote')) {
      locationString = `Hybrid - ${cityStateString}`;
    } else {
      // Multiple types selected
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
        requires_interview: requiresInterview,
        requires_resume: requiresResume,
        application_questions: applicationQuestions ? applicationQuestions.split('\n').filter(q => q.trim()) : null,
        status: 'awaiting_kickoff',
        current_members_count: 1,
      });

      Alert.alert('Success!', 'Your pursuit has been created!', [
        { text: 'OK', onPress: () => {
          // Reset form
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
          setApplicationQuestions('');
          // Close modal and return to feed
          onClose?.();
        }}
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Dynamic styles based on theme
  const dynamicStyles = {
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      backgroundColor: colors.surface,
      padding: 20,
      paddingTop: 60,
      borderBottomWidth: isNewTheme ? 1 : 1,
      borderBottomColor: colors.border,
      shadowColor: isNewTheme ? 'transparent' : '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isNewTheme ? 0 : 0.1,
      shadowRadius: 4,
      elevation: isNewTheme ? 0 : 3,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold' as const,
      color: isNewTheme ? colors.accentGreen : colors.textPrimary,
      fontFamily: isNewTheme ? 'NothingYouCouldDo_400Regular' : (fontsLoaded ? 'NothingYouCouldDo_400Regular' : undefined),
    },
    subtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 5,
      fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    },
    section: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      shadowColor: isNewTheme ? 'transparent' : '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isNewTheme ? 0 : 0.05,
      shadowRadius: 3,
      elevation: isNewTheme ? 0 : 2,
      borderWidth: isNewTheme ? 1 : 0,
      borderColor: colors.border,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold' as const,
      color: colors.textPrimary,
      marginBottom: 16,
      fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    },
    label: {
      fontSize: 14,
      fontWeight: '600' as const,
      color: colors.textPrimary,
      marginBottom: 8,
      marginTop: 8,
      fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    },
    miniLabel: {
      fontSize: 12,
      fontWeight: '600' as const,
      color: colors.textSecondary,
      marginBottom: 4,
      fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    },
    input: {
      backgroundColor: isNewTheme ? colors.surfaceAlt : '#fafafa',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 14,
      marginBottom: 12,
      color: colors.textPrimary,
      fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    },
    hint: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 8,
      fontStyle: 'italic' as const,
      fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    },
    charCount: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 4,
      textAlign: 'right' as const,
      fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: isNewTheme ? colors.surfaceAlt : '#f0f0f0',
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipSelected: {
      backgroundColor: isNewTheme ? colors.accentGreen : legacyColors.secondary,
      borderColor: isNewTheme ? colors.accentGreen : legacyColors.secondary,
    },
    chipText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    },
    chipTextSelected: {
      color: isNewTheme ? colors.background : legacyColors.white,
      fontWeight: 'bold' as const,
    },
    button: {
      backgroundColor: isNewTheme ? colors.accentGreen : legacyColors.secondary,
      borderRadius: 12,
      padding: 18,
      marginTop: 10,
      alignItems: 'center' as const,
      shadowColor: isNewTheme ? 'transparent' : legacyColors.secondary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isNewTheme ? 0 : 0.3,
      shadowRadius: 8,
      elevation: isNewTheme ? 0 : 5,
    },
    buttonText: {
      color: isNewTheme ? colors.background : legacyColors.white,
      fontSize: 17,
      fontWeight: 'bold' as const,
      fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    },
    suggestionsContainer: {
      position: 'absolute' as const,
      top: 48,
      left: 0,
      right: 0,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      maxHeight: 200,
      zIndex: 1000,
      elevation: 5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    suggestionItem: {
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    suggestionText: {
      fontSize: 14,
      color: colors.textPrimary,
      fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    },
    pickerButtonText: {
      fontSize: 14,
      color: colors.textTertiary,
      fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    },
    pickerButtonTextSelected: {
      fontSize: 14,
      color: colors.textPrimary,
      fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: isNewTheme ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end' as const,
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '70%' as const,
      paddingBottom: 20,
    },
    modalHeader: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 'bold' as const,
      color: colors.textPrimary,
      fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    },
    modalClose: {
      fontSize: 24,
      color: colors.textSecondary,
      fontWeight: 'bold' as const,
    },
    stateItem: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    stateItemSelected: {
      backgroundColor: isNewTheme ? 'rgba(168, 230, 163, 0.15)' : '#e0f2fe',
    },
    stateText: {
      fontSize: 15,
      color: colors.textPrimary,
      fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    },
    stateTextSelected: {
      color: isNewTheme ? colors.accentGreen : legacyColors.secondary,
      fontWeight: '600' as const,
    },
    emptyStateText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center' as const,
      fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    },
    clearButton: {
      backgroundColor: isNewTheme ? colors.errorLight : '#fee2e2',
      padding: 12,
      marginHorizontal: 16,
      marginTop: 8,
      borderRadius: 8,
      alignItems: 'center' as const,
    },
    clearButtonText: {
      color: isNewTheme ? colors.error : '#dc2626',
      fontSize: 14,
      fontWeight: '600' as const,
      fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    },
    questionsSection: {
      backgroundColor: isNewTheme ? colors.surfaceAlt : '#f8fafc',
      borderRadius: 12,
      padding: 16,
      marginTop: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    questionsSectionTitle: {
      fontSize: 16,
      fontWeight: 'bold' as const,
      color: colors.textPrimary,
      marginBottom: 4,
      fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    },
    questionsSectionSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 12,
      fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    },
    defaultQuestionsBox: {
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    defaultQuestionsLabel: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: colors.textSecondary,
      marginBottom: 8,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
      fontFamily: isNewTheme ? 'Aboreto_400Regular' : undefined,
    },
    defaultQuestion: {
      fontSize: 14,
      fontWeight: '600' as const,
      color: colors.textPrimary,
      marginBottom: 4,
      lineHeight: 20,
      fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    },
    customizeHint: {
      fontSize: 13,
      color: isNewTheme ? colors.accentGreen : '#059669',
      fontWeight: '500' as const,
      marginBottom: 8,
      fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    },
    selectedTypesContainer: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      gap: 8,
      marginBottom: 12,
    },
    selectedTypeChip: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      backgroundColor: isNewTheme ? colors.accentGreen : legacyColors.secondary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      gap: 6,
    },
    selectedTypeText: {
      color: isNewTheme ? colors.background : legacyColors.white,
      fontSize: 13,
      fontWeight: '600' as const,
      fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    },
    dropdownButton: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      backgroundColor: isNewTheme ? colors.surfaceAlt : '#fafafa',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
    },
    dropdownButtonText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    },
    searchContainer: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      backgroundColor: isNewTheme ? colors.surfaceAlt : '#f5f5f5',
      borderRadius: 8,
      marginHorizontal: 16,
      marginVertical: 12,
      paddingHorizontal: 12,
      borderWidth: isNewTheme ? 1 : 0,
      borderColor: colors.border,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 12,
      fontSize: 14,
      color: colors.textPrimary,
      fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    },
    selectedCount: {
      fontSize: 12,
      color: colors.textSecondary,
      marginHorizontal: 16,
      marginBottom: 8,
      fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    },
    pursuitTypeItem: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    pursuitTypeItemSelected: {
      backgroundColor: isNewTheme ? 'rgba(168, 230, 163, 0.15)' : '#e0f2fe',
    },
    pursuitTypeItemDisabled: {
      opacity: 0.5,
    },
    pursuitTypeText: {
      fontSize: 15,
      color: colors.textPrimary,
      fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    },
    pursuitTypeTextSelected: {
      color: isNewTheme ? colors.accentGreen : legacyColors.secondary,
      fontWeight: '600' as const,
    },
    pursuitTypeTextDisabled: {
      color: colors.textTertiary,
    },
    doneButton: {
      backgroundColor: isNewTheme ? colors.accentGreen : legacyColors.secondary,
      margin: 16,
      padding: 14,
      borderRadius: 8,
      alignItems: 'center' as const,
    },
    doneButtonText: {
      color: isNewTheme ? colors.background : legacyColors.white,
      fontSize: 16,
      fontWeight: '600' as const,
      fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    },
  };

  return (
    <KeyboardAvoidingView
      style={dynamicStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      {isNewTheme && <GrainTexture opacity={0.06} />}

      <View style={dynamicStyles.header}>
        <Text style={dynamicStyles.title}>Create a Pursuit</Text>
        <Text style={dynamicStyles.subtitle}>* = Required fields</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.form}>

          {/* BASIC INFORMATION */}
          <View style={dynamicStyles.section}>
            <Text style={dynamicStyles.sectionTitle}>Basic Information</Text>

            <Text style={dynamicStyles.label}>Title *</Text>
            <TextInput
              style={dynamicStyles.input}
              placeholder="e.g., Learn Java Programming Together"
              placeholderTextColor={colors.textTertiary}
              value={title}
              onChangeText={setTitle}
            />

            <Text style={dynamicStyles.label}>Description * (min 50 characters)</Text>
            <Text style={dynamicStyles.charCount}>{description.length}/50</Text>
            <TextInput
              style={[dynamicStyles.input, styles.textArea]}
              placeholder="Describe your pursuit, who you're looking for, and where you want it to go. Be specific!"
              placeholderTextColor={colors.textTertiary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={6}
            />

            <Text style={dynamicStyles.label}>Team Size Range *</Text>
            <View style={styles.row}>
              <View style={styles.halfInput}>
                <Text style={dynamicStyles.miniLabel}>Min</Text>
                <TextInput
                  style={dynamicStyles.input}
                  placeholder="2"
                  placeholderTextColor={colors.textTertiary}
                  value={teamSizeMin}
                  onChangeText={setTeamSizeMin}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.halfInput}>
                <Text style={dynamicStyles.miniLabel}>Max</Text>
                <TextInput
                  style={dynamicStyles.input}
                  placeholder="8"
                  placeholderTextColor={colors.textTertiary}
                  value={teamSizeMax}
                  onChangeText={setTeamSizeMax}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.switchRow}>
              <Text style={dynamicStyles.label}>Team size flexible?</Text>
              <Switch
                value={teamSizeFlexible}
                onValueChange={setTeamSizeFlexible}
                trackColor={{ false: colors.border, true: isNewTheme ? colors.accentGreenMuted : legacyColors.secondary }}
                thumbColor={teamSizeFlexible ? (isNewTheme ? colors.accentGreen : legacyColors.white) : colors.surface}
              />
            </View>

            <Text style={dynamicStyles.label}>Location Type * (Select all that apply)</Text>
            <Text style={dynamicStyles.hint}>Select In-person, Hybrid, and/or Remote</Text>
            <View style={styles.chipContainer}>
              {['In-person', 'Hybrid', 'Remote'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[dynamicStyles.chip, locationTypes.includes(type) && dynamicStyles.chipSelected]}
                  onPress={() => toggleLocationType(type)}
                >
                  <Text style={[dynamicStyles.chipText, locationTypes.includes(type) && dynamicStyles.chipTextSelected]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {(locationTypes.includes('In-person') || locationTypes.includes('Hybrid')) && (
              <>
                <Text style={dynamicStyles.label}>City *</Text>
                <Text style={dynamicStyles.hint}>
                  {locationState
                    ? `Start typing to search cities in ${locationState}`
                    : 'Start typing to search cities'}
                </Text>
                <View>
                  <TextInput
                    style={dynamicStyles.input}
                    placeholder="Search city (e.g., Austin)"
                    placeholderTextColor={colors.textTertiary}
                    value={citySearchQuery}
                    onChangeText={handleCitySearch}
                    autoCapitalize="words"
                  />
                  {showCitySuggestions && filteredCities.length > 0 && (
                    <View style={dynamicStyles.suggestionsContainer}>
                      <ScrollView style={styles.suggestionsList} keyboardShouldPersistTaps="handled">
                        {filteredCities.map((city, index) => (
                          <TouchableOpacity
                            key={index}
                            style={dynamicStyles.suggestionItem}
                            onPress={() => selectCity(city)}
                          >
                            <Text style={dynamicStyles.suggestionText}>{city}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                <Text style={dynamicStyles.label}>State *</Text>
                <TouchableOpacity
                  style={[dynamicStyles.input, styles.pickerButton]}
                  onPress={() => setShowStateModal(true)}
                >
                  <Text style={locationState ? dynamicStyles.pickerButtonTextSelected : dynamicStyles.pickerButtonText}>
                    {locationState || 'Select state'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            <Text style={dynamicStyles.label}>Projected Duration (optional)</Text>
            <TextInput
              style={dynamicStyles.input}
              placeholder="e.g., 3 months, 1 year, ongoing"
              placeholderTextColor={colors.textTertiary}
              value={projectedDuration}
              onChangeText={setProjectedDuration}
            />
          </View>

          {/* PURSUIT TYPE */}
          <View style={dynamicStyles.section}>
            <Text style={dynamicStyles.sectionTitle}>Pursuit Type * (Select 1-3)</Text>
            <Text style={dynamicStyles.hint}>Selected: {selectedTypes.length}/3</Text>

            {/* Selected types display */}
            {selectedTypes.length > 0 && (
              <View style={dynamicStyles.selectedTypesContainer}>
                {selectedTypes.map((type) => (
                  <View key={type} style={dynamicStyles.selectedTypeChip}>
                    <Text style={dynamicStyles.selectedTypeText}>{type}</Text>
                    <TouchableOpacity onPress={() => setSelectedTypes(selectedTypes.filter(t => t !== type))}>
                      <Ionicons name="close-circle" size={18} color={isNewTheme ? colors.background : legacyColors.white} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Dropdown button */}
            <TouchableOpacity
              style={dynamicStyles.dropdownButton}
              onPress={() => setShowPursuitTypeModal(true)}
            >
              <Text style={dynamicStyles.dropdownButtonText}>
                {selectedTypes.length === 0 ? 'Select pursuit types...' : 'Add more types...'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* CATEGORIES */}
          <View style={dynamicStyles.section}>
            <Text style={dynamicStyles.sectionTitle}>Categories (optional, up to 5)</Text>
            <Text style={dynamicStyles.hint}>Comma-separated (e.g., tech, basketball, pokemon)</Text>
            <TextInput
              style={dynamicStyles.input}
              placeholder="tech, basketball, pokemon"
              placeholderTextColor={colors.textTertiary}
              value={categories}
              onChangeText={setCategories}
            />
          </View>

          {/* BUSINESS-SPECIFIC */}
          {selectedTypes.includes('Business') && (
            <View style={dynamicStyles.section}>
              <Text style={dynamicStyles.sectionTitle}>Business Details</Text>
              <Text style={dynamicStyles.label}>Ownership Structure</Text>
              <TextInput
                style={dynamicStyles.input}
                placeholder="e.g., Distributed evenly, Admin owns 90%"
                placeholderTextColor={colors.textTertiary}
                value={ownershipStructure}
                onChangeText={setOwnershipStructure}
              />
            </View>
          )}

          {/* DECISION SYSTEM */}
          <View style={dynamicStyles.section}>
            <Text style={dynamicStyles.sectionTitle}>Decision System *</Text>
            <View style={styles.chipContainer}>
              {DECISION_SYSTEMS.map((system) => (
                <TouchableOpacity
                  key={system}
                  style={[dynamicStyles.chip, decisionSystem === system && dynamicStyles.chipSelected]}
                  onPress={() => setDecisionSystem(system)}
                >
                  <Text style={[dynamicStyles.chipText, decisionSystem === system && dynamicStyles.chipTextSelected]}>
                    {system}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={dynamicStyles.input}
              placeholder="Add a note about your decision system (optional)"
              placeholderTextColor={colors.textTertiary}
              value={decisionNote}
              onChangeText={setDecisionNote}
            />
          </View>

          {/* MEETING DETAILS */}
          <View style={dynamicStyles.section}>
            <Text style={dynamicStyles.sectionTitle}>Meeting Details</Text>

            <Text style={dynamicStyles.label}>Meeting Cadence *</Text>
            <TextInput
              style={dynamicStyles.input}
              placeholder="e.g., Weekly on Mondays at 7pm"
              placeholderTextColor={colors.textTertiary}
              value={meetingCadence}
              onChangeText={setMeetingCadence}
            />
            <TextInput
              style={dynamicStyles.input}
              placeholder="Add a note (optional)"
              placeholderTextColor={colors.textTertiary}
              value={meetingNote}
              onChangeText={setMeetingNote}
            />

            <Text style={dynamicStyles.label}>Attendance Style *</Text>
            <View style={styles.chipContainer}>
              {ATTENDANCE_STYLES.map((style) => (
                <TouchableOpacity
                  key={style}
                  style={[dynamicStyles.chip, attendanceStyle === style && dynamicStyles.chipSelected]}
                  onPress={() => setAttendanceStyle(style)}
                >
                  <Text style={[dynamicStyles.chipText, attendanceStyle === style && dynamicStyles.chipTextSelected]}>
                    {style}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={dynamicStyles.input}
              placeholder="Set expectations for attendance (optional)"
              placeholderTextColor={colors.textTertiary}
              value={attendanceNote}
              onChangeText={setAttendanceNote}
            />
          </View>

          {/* ACCOUNTABILITY */}
          {selectedTypes.includes('Accountability') && (
            <View style={dynamicStyles.section}>
              <Text style={dynamicStyles.sectionTitle}>Accountability Mechanics</Text>
              <Text style={dynamicStyles.hint}>Comma-separated (e.g., streaks, check-ins, contributions)</Text>
              <TextInput
                style={dynamicStyles.input}
                placeholder="streaks, check-ins, tasks complete"
                placeholderTextColor={colors.textTertiary}
                value={accountabilityMechanics}
                onChangeText={setAccountabilityMechanics}
              />
            </View>
          )}

          {/* ROLES & EXPERIENCE */}
          <View style={dynamicStyles.section}>
            <Text style={dynamicStyles.sectionTitle}>Roles & Experience (optional)</Text>

            <Text style={dynamicStyles.label}>Roles</Text>
            <Text style={dynamicStyles.hint}>Comma-separated roles you're looking for</Text>
            <TextInput
              style={dynamicStyles.input}
              placeholder="Developer, Designer, Marketing Lead"
              placeholderTextColor={colors.textTertiary}
              value={roles}
              onChangeText={setRoles}
            />

            <Text style={dynamicStyles.label}>Experience Level</Text>
            <TextInput
              style={dynamicStyles.input}
              placeholder="e.g., 5+ years, Beginner, Intermediate"
              placeholderTextColor={colors.textTertiary}
              value={experienceLevel}
              onChangeText={setExperienceLevel}
            />

            <Text style={dynamicStyles.label}>Current Stage in Process</Text>
            <TextInput
              style={dynamicStyles.input}
              placeholder="e.g., Just starting, Have a prototype"
              placeholderTextColor={colors.textTertiary}
              value={currentStage}
              onChangeText={setCurrentStage}
            />
          </View>

          {/* RESTRICTIONS */}
          <View style={dynamicStyles.section}>
            <Text style={dynamicStyles.sectionTitle}>Restrictions (optional)</Text>
            <Text style={dynamicStyles.label}>Age Restriction</Text>
            <TextInput
              style={dynamicStyles.input}
              placeholder="e.g., 18+, 21+ for cocktails, Students only"
              placeholderTextColor={colors.textTertiary}
              value={ageRestriction}
              onChangeText={setAgeRestriction}
            />
          </View>

          {/* APPLICATION SETTINGS */}
          <View style={dynamicStyles.section}>
            <Text style={dynamicStyles.sectionTitle}>Application Settings</Text>

            <View style={styles.switchRow}>
              <Text style={dynamicStyles.label}>Continue accepting after kickoff?</Text>
              <Switch
                value={continueAccepting}
                onValueChange={setContinueAccepting}
                trackColor={{ false: colors.border, true: isNewTheme ? colors.accentGreenMuted : legacyColors.secondary }}
                thumbColor={continueAccepting ? (isNewTheme ? colors.accentGreen : legacyColors.white) : colors.surface}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={dynamicStyles.label}>Include interview option?</Text>
              <Switch
                value={requiresInterview}
                onValueChange={setRequiresInterview}
                trackColor={{ false: colors.border, true: isNewTheme ? colors.accentGreenMuted : legacyColors.secondary }}
                thumbColor={requiresInterview ? (isNewTheme ? colors.accentGreen : legacyColors.white) : colors.surface}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={dynamicStyles.label}>Require resume?</Text>
              <Switch
                value={requiresResume}
                onValueChange={setRequiresResume}
                trackColor={{ false: colors.border, true: isNewTheme ? colors.accentGreenMuted : legacyColors.secondary }}
                thumbColor={requiresResume ? (isNewTheme ? colors.accentGreen : legacyColors.white) : colors.surface}
              />
            </View>

            {/* Application Questions Section */}
            <View style={dynamicStyles.questionsSection}>
              <Text style={dynamicStyles.questionsSectionTitle}>Application Questions</Text>
              <Text style={dynamicStyles.questionsSectionSubtitle}>
                Use the default questions below or personalize your own
              </Text>

              <View style={dynamicStyles.defaultQuestionsBox}>
                <Text style={dynamicStyles.defaultQuestionsLabel}>Default Questions:</Text>
                <Text style={dynamicStyles.defaultQuestion}>- Why are you a good team fit?</Text>
                <Text style={dynamicStyles.defaultQuestion}>- Where do you hope to see this go?</Text>
              </View>

              <Text style={dynamicStyles.customizeHint}>
                Tap below to edit or add your own questions (one per line)
              </Text>

              <TextInput
                style={[dynamicStyles.input, styles.textArea]}
                placeholder="Why are you a good team fit?&#10;Where do you hope to see this go?"
                placeholderTextColor={colors.textTertiary}
                value={applicationQuestions}
                onChangeText={setApplicationQuestions}
                multiline
                numberOfLines={4}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[dynamicStyles.button, loading && styles.buttonDisabled]}
            onPress={handleCreate}
            disabled={loading}
          >
            <Text style={dynamicStyles.buttonText}>
              {loading ? 'Creating...' : 'Create Pursuit'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* State Picker Modal */}
      <Modal
        visible={showStateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStateModal(false)}
      >
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.modalContent}>
            <View style={dynamicStyles.modalHeader}>
              <Text style={dynamicStyles.modalTitle}>
                Select State{locationCity ? ` (for ${locationCity})` : ''}
              </Text>
              <TouchableOpacity onPress={() => setShowStateModal(false)}>
                <Text style={dynamicStyles.modalClose}>x</Text>
              </TouchableOpacity>
            </View>
            {locationState ? (
              <TouchableOpacity style={dynamicStyles.clearButton} onPress={clearState}>
                <Text style={dynamicStyles.clearButtonText}>x Clear selection ({locationState})</Text>
              </TouchableOpacity>
            ) : null}
            {filteredStates.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <Text style={dynamicStyles.emptyStateText}>No states found for the selected city</Text>
              </View>
            ) : (
              <FlatList
                data={filteredStates}
                keyExtractor={(item) => item.abbr}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[dynamicStyles.stateItem, locationState === item.abbr && dynamicStyles.stateItemSelected]}
                    onPress={() => selectState(item.abbr)}
                  >
                    <Text style={[dynamicStyles.stateText, locationState === item.abbr && dynamicStyles.stateTextSelected]}>
                      {item.name} ({item.abbr}){locationState === item.abbr ? ' (tap to deselect)' : ''}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Pursuit Type Picker Modal */}
      <Modal
        visible={showPursuitTypeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPursuitTypeModal(false)}
      >
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.modalContent}>
            <View style={dynamicStyles.modalHeader}>
              <Text style={dynamicStyles.modalTitle}>Select Pursuit Types</Text>
              <TouchableOpacity onPress={() => {
                setShowPursuitTypeModal(false);
                setPursuitTypeSearch('');
              }}>
                <Text style={dynamicStyles.modalClose}>x</Text>
              </TouchableOpacity>
            </View>

            {/* Search input */}
            <View style={dynamicStyles.searchContainer}>
              <Ionicons name="search" size={20} color={colors.textTertiary} style={styles.searchIcon} />
              <TextInput
                style={dynamicStyles.searchInput}
                placeholder="Search pursuit types..."
                placeholderTextColor={colors.textTertiary}
                value={pursuitTypeSearch}
                onChangeText={setPursuitTypeSearch}
                autoCapitalize="none"
              />
              {pursuitTypeSearch.length > 0 && (
                <TouchableOpacity onPress={() => setPursuitTypeSearch('')}>
                  <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Selected count */}
            <Text style={dynamicStyles.selectedCount}>
              {selectedTypes.length}/3 selected
              {selectedTypes.length >= 3 && ' (max reached)'}
            </Text>

            {/* Pursuit types list */}
            <FlatList
              data={PURSUIT_TYPES.filter(type =>
                type.toLowerCase().includes(pursuitTypeSearch.toLowerCase())
              )}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const isSelected = selectedTypes.includes(item);
                const isDisabled = !isSelected && selectedTypes.length >= 3;
                return (
                  <TouchableOpacity
                    style={[
                      dynamicStyles.pursuitTypeItem,
                      isSelected && dynamicStyles.pursuitTypeItemSelected,
                      isDisabled && dynamicStyles.pursuitTypeItemDisabled
                    ]}
                    onPress={() => {
                      if (isSelected) {
                        setSelectedTypes(selectedTypes.filter(t => t !== item));
                      } else if (selectedTypes.length < 3) {
                        setSelectedTypes([...selectedTypes, item]);
                      }
                    }}
                    disabled={isDisabled}
                  >
                    <Text style={[
                      dynamicStyles.pursuitTypeText,
                      isSelected && dynamicStyles.pursuitTypeTextSelected,
                      isDisabled && dynamicStyles.pursuitTypeTextDisabled
                    ]}>
                      {item}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={22} color={isNewTheme ? colors.accentGreen : legacyColors.secondary} />
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyStateContainer}>
                  <Text style={dynamicStyles.emptyStateText}>No matching pursuit types</Text>
                </View>
              }
            />

            {/* Done button */}
            <TouchableOpacity
              style={dynamicStyles.doneButton}
              onPress={() => {
                setShowPursuitTypeModal(false);
                setPursuitTypeSearch('');
              }}
            >
              <Text style={dynamicStyles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  form: { padding: 20, paddingBottom: 120 },
  textArea: { height: 100, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 10 },
  halfInput: { flex: 1 },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  buttonDisabled: { opacity: 0.6 },
  suggestionsList: {
    maxHeight: 200,
  },
  pickerButton: {
    justifyContent: 'center',
  },
  emptyStateContainer: {
    padding: 40,
    alignItems: 'center',
  },
  searchIcon: {
    marginRight: 8,
  },
});
