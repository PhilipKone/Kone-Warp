import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { 
  Bike, Car, Truck, Plane, Camera, Compass, Search, MapPin, 
  Activity, ShoppingBag, ShieldCheck, Eye, Wifi, Battery, 
  Clock, ArrowRight, ChevronUp, ChevronDown, Check, Scan, Cpu, 
  Navigation, Plus, Minus, ArrowLeft, User, Sparkles
} from 'lucide-react';
import { 
  createRideRecord, updateRideStatus, 
  createDeliveryOrder, updateDeliveryStatus, 
  initializeTelemetryNodes, listenToTelemetryNodes,
  getUserRideHistory, getUserDeliveryHistory
} from '../services/dbService';
import {
  subscribeToAuth, loginWithEmail, registerWithEmail, logoutUser
} from '../services/authService';
import './KoneWarp.css';

// Predefined mock locations in Accra/Volta Region with actual Latitude & Longitude
const LOCATIONS = [
  { name: 'Kone Academy Hub', coords: { lat: 5.6145, lng: -0.1872 } },
  { name: 'Kone Labs (East Legon)', coords: { lat: 5.6322, lng: -0.1654 } },
  { name: 'Kone Farms (Volta Delta)', coords: { lat: 5.8943, lng: 0.5843 } }, // Volta Region
  { name: 'Kotoka Intl Airport', coords: { lat: 5.6054, lng: -0.1681 } },
  { name: 'Accra Mall', coords: { lat: 5.6212, lng: -0.1686 } },
  { name: 'Tema Port', coords: { lat: 5.6334, lng: -0.0123 } }
];

// Vehicle options
const VEHICLES = [
  { id: 'bike', name: 'EV Warp Bike', type: 'Electric Bike', icon: Bike, basePrice: 5.0, perKm: 1.2, speed: 45, multiplier: 0.6, co2: 0, glow: '#10b981' },
  { id: 'moto', name: 'Kone Moto', type: 'Motorcycle', icon: Bike, basePrice: 7.0, perKm: 1.5, speed: 60, multiplier: 0.8, co2: 25, glow: '#fbbf24' },
  { id: 'car', name: 'Warp Comfort', type: 'Premium Car', icon: Car, basePrice: 12.0, perKm: 2.2, speed: 80, multiplier: 1.0, co2: 60, glow: '#8b5cf6' },
  { id: 'truck', name: 'Cargo Warp', type: 'Heavy Truck', icon: Truck, basePrice: 25.0, perKm: 3.5, speed: 50, multiplier: 1.5, co2: 120, glow: '#ec4899' },
  { id: 'plane', name: 'Jet Warp', type: 'Supersonic Air', icon: Plane, basePrice: 120.0, perKm: 15.0, speed: 450, multiplier: 5.0, co2: 300, glow: '#06b6d4' }
];

// Mock Food/Market items
const MARKET_ITEMS = [
  { id: 'shito', name: 'Kone Premium Shito', category: 'Farms', price: 35.0, rating: 4.9, image: '🌶️', desc: 'Volta Region Scotch Bonnet & Smoked Herring' },
  { id: 'peppers', name: 'Organic Scotch Bonnets', category: 'Farms', price: 15.0, rating: 4.8, image: '🔥', desc: 'Freshly harvested hand-picked hot peppers' },
  { id: 'shrimp', name: 'Dried Volta Shrimp', category: 'Farms', price: 25.0, rating: 4.7, image: '🦐', desc: 'Sun-dried premium river shrimp' },
  { id: 'shallots', name: 'Anloga Red Shallots', category: 'Farms', price: 10.0, rating: 4.6, image: '🧅', desc: 'Sweet, flavorful shallots from sandy soils' },
  { id: 'iot_kit', name: 'Kone Smart Soil Node', category: 'Lab', price: 150.0, rating: 5.0, image: '📟', desc: 'Telemetry kit for farming automation' }
];

// Haversine Distance Formula (Factual Coordinate Calculation)
function getHaversineDistance(coords1, coords2) {
  const R = 6371; // Earth radius in km
  const dLat = (coords2.lat - coords1.lat) * Math.PI / 180;
  const dLng = (coords2.lng - coords1.lng) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(coords1.lat * Math.PI / 180) * Math.cos(coords2.lat * Math.PI / 180) * 
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(1));
}

export default function KoneWarp() {
  const [activeTab, setActiveTab] = useState('ride'); // ride, delivery, vision, activity
  const [timeStr, setTimeStr] = useState('09:41 AM');
  
  // Rideshare state
  const [pickup, setPickup] = useState(LOCATIONS[0]);
  const [dropoff, setDropoff] = useState(LOCATIONS[1]);
  const [selectedVehicle, setSelectedVehicle] = useState(VEHICLES[2]); // Comfort Car default
  const [distance, setDistance] = useState(0);
  const [ridePrice, setRidePrice] = useState(0);
  const [rideEta, setRideEta] = useState(0);
  const [rideState, setRideState] = useState('idle'); // idle, matching, booked, completed
  const [driverProgress, setDriverProgress] = useState(0);

  // Nominatim Autocomplete state
  const [pickupQuery, setPickupQuery] = useState(LOCATIONS[0].name);
  const [dropoffQuery, setDropoffQuery] = useState(LOCATIONS[1].name);
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState([]);
  const [isLoadingPickup, setIsLoadingPickup] = useState(false);
  const [isLoadingDropoff, setIsLoadingDropoff] = useState(false);
  
  // Delivery State
  const [cart, setCart] = useState([]);
  const [deliverySpeed, setDeliverySpeed] = useState('warp'); // standard, warp
  const [orderState, setOrderState] = useState('idle'); // idle, ordered, delivering, arrived
  const [deliveryEta, setDeliveryEta] = useState(15);
  
  // CV/Vision State
  const [cvActive, setCvActive] = useState(true);
  const [cvScanner, setCvScanner] = useState(true);
  const [cvDistance, setCvDistance] = useState(true);
  const [cvObjects, setCvObjects] = useState([]);
  const [cvFPS, setCvFPS] = useState(30);
  const [cvSystemLoad, setCvSystemLoad] = useState(24);
  const [cvTerminalLogs, setCvTerminalLogs] = useState([]);
  
  // Telemetry Nodes (live from db)
  const [telemetryNodes, setTelemetryNodes] = useState([
    { id: 'node_ev_04', nodeName: 'Warp Bike Node-04', batteryPercent: 84, temperatureC: 32, status: 'online' },
    { id: 'node_comfort_12', nodeName: 'Sedan Comfort Node-12', batteryPercent: 62, temperatureC: 38, status: 'online' },
    { id: 'node_drone_01', nodeName: 'Supersonic Drone-01', batteryPercent: 100, temperatureC: 22, status: 'standby' }
  ]);

  // Auth State
  const [currentUser, setCurrentUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // login, signup
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [userRides, setUserRides] = useState([]);
  const [userDeliveries, setUserDeliveries] = useState([]);

  // Bottom drawer state (mobile only)
  const [drawerOpen, setDrawerOpen] = useState(true);

  // References for live video stream
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // References for Leaflet Map
  const mapRef = useRef(null);
  const routeLineRef = useRef(null);
  const pickupMarkerRef = useRef(null);
  const dropoffMarkerRef = useRef(null);
  const driverMarkerRef = useRef(null);
  
  // Tracking references for active db documents
  const activeRideIdRef = useRef(null);
  const activeOrderIdRef = useRef(null);

  // Clock update
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      setTimeStr(`${hours}:${minutes} ${ampm}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Auth subscription
  useEffect(() => {
    const unsubscribe = subscribeToAuth((user) => {
      setCurrentUser(user);
      if (user) {
        fetchUserHistory(user.uid);
      } else {
        setUserRides([]);
        setUserDeliveries([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchUserHistory = async (uid) => {
    try {
      const rides = await getUserRideHistory(uid);
      const deliveries = await getUserDeliveryHistory(uid);
      setUserRides(rides);
      setUserDeliveries(deliveries);
    } catch (err) {
      console.error('Error fetching user history:', err);
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      if (authMode === 'login') {
        const user = await loginWithEmail(authEmail, authPassword);
        setCurrentUser(user);
      } else {
        const user = await registerWithEmail(authEmail, authPassword);
        setCurrentUser(user);
      }
      setShowAuthModal(false);
      setAuthEmail('');
      setAuthPassword('');
    } catch (err) {
      let msg = err.message;
      if (msg.includes('auth/invalid-credential') || msg.includes('auth/user-not-found') || msg.includes('auth/wrong-password')) {
        msg = 'Invalid email or password.';
      } else if (msg.includes('auth/email-already-in-use')) {
        msg = 'Email is already registered.';
      } else if (msg.includes('auth/weak-password')) {
        msg = 'Password should be at least 6 characters.';
      } else if (msg.includes('auth/invalid-email')) {
        msg = 'Invalid email format.';
      }
      setAuthError(msg);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      setCurrentUser(null);
      setUserRides([]);
      setUserDeliveries([]);
    } catch (err) {
      console.error('Error logging out:', err);
    }
  };

  // Nominatim Autocomplete for Pickup
  useEffect(() => {
    if (pickupQuery.length < 3 || pickupQuery === pickup.name) {
      setPickupSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsLoadingPickup(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(pickupQuery + ', Accra')}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setPickupSuggestions(data.map(item => ({
            name: item.display_name.split(',').slice(0, 3).join(','),
            coords: { lat: parseFloat(item.lat), lng: parseFloat(item.lon) }
          })));
        }
      } catch (err) {
        console.error('Error fetching pickup suggestions:', err);
      } finally {
        setIsLoadingPickup(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [pickupQuery, pickup.name]);

  // Nominatim Autocomplete for Dropoff
  useEffect(() => {
    if (dropoffQuery.length < 3 || dropoffQuery === dropoff.name) {
      setDropoffSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsLoadingDropoff(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(dropoffQuery + ', Accra')}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setDropoffSuggestions(data.map(item => ({
            name: item.display_name.split(',').slice(0, 3).join(','),
            coords: { lat: parseFloat(item.lat), lng: parseFloat(item.lon) }
          })));
        }
      } catch (err) {
        console.error('Error fetching dropoff suggestions:', err);
      } finally {
        setIsLoadingDropoff(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [dropoffQuery, dropoff.name]);

  // Camera stream Effect
  useEffect(() => {
    let active = true;

    async function startCamera() {
      if (activeTab === 'vision' && cvActive) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
          });
          if (active && videoRef.current) {
            videoRef.current.srcObject = stream;
            streamRef.current = stream;
          } else {
            stream.getTracks().forEach(track => track.stop());
          }
        } catch (err) {
          console.warn('Webcam stream failed to start:', err);
        }
      } else {
        stopCamera();
      }
    }

    function stopCamera() {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }

    startCamera();

    return () => {
      active = false;
      stopCamera();
    };
  }, [activeTab, cvActive]);

  // Distance & Price calculation (Factual coordinates)
  useEffect(() => {
    if (pickup && dropoff) {
      const kms = getHaversineDistance(pickup.coords, dropoff.coords);
      setDistance(kms);
      
      const price = selectedVehicle.basePrice + (kms * selectedVehicle.perKm);
      setRidePrice(parseFloat(price.toFixed(2)));
      
      const etaMin = Math.ceil((kms / selectedVehicle.speed) * 60);
      setRideEta(etaMin);
    }
  }, [pickup, dropoff, selectedVehicle]);

  // DB Telemetry listener initialization
  useEffect(() => {
    initializeTelemetryNodes();
    const unsubscribe = listenToTelemetryNodes((nodes) => {
      if (nodes && nodes.length > 0) {
        setTelemetryNodes(nodes);
      }
    });
    return () => unsubscribe();
  }, []);

  // Leaflet Map Initialization
  useEffect(() => {
    if (activeTab === 'ride' && !mapRef.current) {
      const container = document.getElementById('map-container');
      if (container) {
        const map = L.map('map-container', {
          center: [5.6145, -0.1872], // Center on Accra Hub
          zoom: 13,
          zoomControl: false,
          attributionControl: false
        });

        // Beautiful dark themed tile grids (OSM powered)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 20
        }).addTo(map);

        mapRef.current = map;
      }
    }

    return () => {
      if (activeTab !== 'ride' && mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        routeLineRef.current = null;
        pickupMarkerRef.current = null;
        dropoffMarkerRef.current = null;
        driverMarkerRef.current = null;
      }
    };
  }, [activeTab]);

  // Leaflet Path & Marker Updates
  useEffect(() => {
    if (activeTab === 'ride' && mapRef.current && pickup && dropoff) {
      const map = mapRef.current;

      // Clear previous overlays
      if (routeLineRef.current) map.removeLayer(routeLineRef.current);
      if (pickupMarkerRef.current) map.removeLayer(pickupMarkerRef.current);
      if (dropoffMarkerRef.current) map.removeLayer(dropoffMarkerRef.current);

      // Create pickup and dropoff circle overlays
      pickupMarkerRef.current = L.circleMarker([pickup.coords.lat, pickup.coords.lng], {
        radius: 8,
        fillColor: '#10b981',
        color: '#ffffff',
        weight: 2,
        fillOpacity: 1
      }).addTo(map).bindPopup(`Pickup: ${pickup.name}`);

      dropoffMarkerRef.current = L.circleMarker([dropoff.coords.lat, dropoff.coords.lng], {
        radius: 8,
        fillColor: '#ef4444',
        color: '#ffffff',
        weight: 2,
        fillOpacity: 1
      }).addTo(map).bindPopup(`Dropoff: ${dropoff.name}`);

      const latlngs = [
        [pickup.coords.lat, pickup.coords.lng],
        [dropoff.coords.lat, dropoff.coords.lng]
      ];

      routeLineRef.current = L.polyline(latlngs, {
        color: selectedVehicle.glow,
        weight: 4,
        dashArray: '8, 8',
        opacity: 0.8
      }).addTo(map);

      // Auto fit viewport bounds to show both pins
      const bounds = L.latLngBounds(latlngs);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [activeTab, pickup, dropoff, selectedVehicle]);

  // Driver movement simulation (Factual database telemetry updates)
  useEffect(() => {
    let interval;
    if (rideState === 'booked' && mapRef.current && pickup) {
      const startLat = pickup.coords.lat - 0.003;
      const startLng = pickup.coords.lng + 0.003;
      const endLat = pickup.coords.lat;
      const endLng = pickup.coords.lng;
      
      // Spawn driver marker overlay
      if (!driverMarkerRef.current) {
        driverMarkerRef.current = L.circleMarker([startLat, startLng], {
          radius: 9,
          fillColor: selectedVehicle.glow,
          color: '#ffffff',
          weight: 2,
          fillOpacity: 1
        }).addTo(mapRef.current);
      }
      
      let step = 0;
      const totalSteps = 80;
      
      interval = setInterval(() => {
        if (step <= totalSteps) {
          const progress = step / totalSteps;
          const currentLat = startLat + (endLat - startLat) * progress;
          const currentLng = startLng + (endLng - startLng) * progress;
          
          if (driverMarkerRef.current) {
            driverMarkerRef.current.setLatLng([currentLat, currentLng]);
          }
          
          setDriverProgress(Math.round(progress * 100));
          
          // Write real coordinates to Firebase rides doc
          if (activeRideIdRef.current) {
            updateRideStatus(activeRideIdRef.current, 'booked', {
              driverCoords: { lat: currentLat, lng: currentLng }
            });
          }
          
          step += 1;
        } else {
          clearInterval(interval);
          setRideState('completed');
          if (activeRideIdRef.current) {
            updateRideStatus(activeRideIdRef.current, 'completed');
            if (currentUser) {
              fetchUserHistory(currentUser.uid);
            }
          }
        }
      }, 150);
    }
    return () => {
      if (interval) clearInterval(interval);
      if (driverMarkerRef.current && mapRef.current) {
        mapRef.current.removeLayer(driverMarkerRef.current);
        driverMarkerRef.current = null;
      }
    };
  }, [rideState, pickup, selectedVehicle, currentUser]);

  // CV simulation loop
  useEffect(() => {
    let interval;
    if (activeTab === 'vision' && cvActive) {
      const objectsPool = [
        { label: 'EV Warp Bike', conf: 0.98, dist: '4.2m', color: '#10b981', x: 80, y: 120 },
        { label: 'Pedestrian', conf: 0.95, dist: '2.1m', color: '#3b82f6', x: 210, y: 160 },
        { label: 'Volta Pepper Crate', conf: 0.99, dist: '0.8m', color: '#ec4899', x: 150, y: 220 },
        { label: 'Autonomous Drone', conf: 0.92, dist: '12.4m', color: '#a855f7', x: 280, y: 80 },
        { label: 'Comfort Sedan', conf: 0.89, dist: '8.5m', color: '#8b5cf6', x: 50, y: 280 },
        { label: 'Traffic Light', conf: 0.97, dist: '15.0m', color: '#fbbf24', x: 310, y: 140 }
      ];

      const logsPool = [
        'INIT: Loading OpenCV Engine v3.4...',
        'CV_CORE: Loaded weights for [Vehicles, AgritechCargo, Pedestrians]',
        'SENSORS: LiDAR range calibrator set to 25.0 meters',
        'TELEM: Battery voltage normal (48.2V) - EV Pack Alpha',
        'DETECT: Classified agricultural crate [CONF=0.99]',
        'ROUTING: Recalculating path to avoid congestion near Legon bypass',
        'API: Uploading telemetry logs to Firebase'
      ];

      setCvTerminalLogs(logsPool);

      interval = setInterval(() => {
        const count = 2 + Math.floor(Math.random() * 3);
        const selected = [];
        const poolCopy = [...objectsPool];
        
        for (let i = 0; i < count; i++) {
          if (poolCopy.length === 0) break;
          const idx = Math.floor(Math.random() * poolCopy.length);
          const obj = poolCopy.splice(idx, 1)[0];
          obj.x = Math.max(10, Math.min(300, obj.x + (Math.random() * 20 - 10)));
          obj.y = Math.max(10, Math.min(280, obj.y + (Math.random() * 20 - 10)));
          
          if (cvDistance) {
            const mDistance = (0.5 + Math.random() * 15).toFixed(1);
            obj.dist = `${mDistance}m`;
          }
          selected.push(obj);
        }
        
        setCvObjects(selected);
        setCvFPS(28 + Math.floor(Math.random() * 5));
        setCvSystemLoad(18 + Math.floor(Math.random() * 12));
        
        if (Math.random() > 0.4) {
          const freshLog = `DETECT: Recognized ${selected[0]?.label || 'Object'} (conf=${selected[0]?.conf || 0.95}) at ${selected[0]?.dist || '3.5m'}`;
          setCvTerminalLogs(prev => [freshLog, ...prev.slice(0, 12)]);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeTab, cvActive, cvDistance]);

  // Cart operations
  const addToCart = (item) => {
    const existing = cart.find(i => i.id === item.id);
    if (existing) {
      setCart(cart.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i));
    } else {
      setCart([...cart, { ...item, qty: 1 }]);
    }
  };

  const updateQty = (id, delta) => {
    setCart(cart.map(i => {
      if (i.id === id) {
        const newQty = i.qty + delta;
        return newQty > 0 ? { ...i, qty: newQty } : null;
      }
      return i;
    }).filter(Boolean));
  };

  const getCartTotal = () => {
    const subtotal = cart.reduce((acc, i) => acc + (i.price * i.qty), 0);
    const fee = cart.length > 0 ? (deliverySpeed === 'warp' ? 15.0 : 8.0) : 0;
    return { subtotal, fee, total: subtotal + fee };
  };

  // Rideshare Booking
  const handleBooking = async () => {
    if (!currentUser) {
      setAuthMode('login');
      setAuthError('Please sign in to book a ride.');
      setShowAuthModal(true);
      return;
    }
    setRideState('matching');
    try {
      const rideId = await createRideRecord(pickup, dropoff, ridePrice, distance, selectedVehicle, currentUser.uid);
      activeRideIdRef.current = rideId;
      
      setTimeout(async () => {
        setRideState('booked');
        if (rideId) {
          await updateRideStatus(rideId, 'booked', {
            driverId: 'driver_agent_alpha',
            driverCoords: { lat: pickup.coords.lat - 0.003, lng: pickup.coords.lng + 0.003 }
          });
        }
      }, 2000);
    } catch (e) {
      console.warn('Firebase booking writing error, matching local simulation:', e);
      setTimeout(() => {
        setRideState('booked');
      }, 2000);
    }
  };

  const handleResetRide = () => {
    setRideState('idle');
    setDriverProgress(0);
    activeRideIdRef.current = null;
  };

  // Volta Market Order Placement
  const submitOrder = async () => {
    if (cart.length === 0) return;
    if (!currentUser) {
      setAuthMode('login');
      setAuthError('Please sign in to place an order.');
      setShowAuthModal(true);
      return;
    }
    setOrderState('ordered');
    setDeliveryEta(deliverySpeed === 'warp' ? 10 : 25);
    
    const { subtotal, fee, total } = getCartTotal();
    
    try {
      const orderId = await createDeliveryOrder(cart, subtotal, fee, total, deliverySpeed, currentUser.uid);
      activeOrderIdRef.current = orderId;
      
      setTimeout(async () => {
        setOrderState('delivering');
        if (orderId) await updateDeliveryStatus(orderId, 'delivering');
        setCvTerminalLogs(prev => [
          `LOGISTICS: Dispatching EV Warp Bike for order #KW-${orderId.substring(0, 5)}`,
          ...prev
        ]);
      }, 4000);

      setTimeout(async () => {
        setOrderState('arrived');
        setCart([]);
        if (orderId) await updateDeliveryStatus(orderId, 'arrived');
        if (currentUser) {
          fetchUserHistory(currentUser.uid);
        }
        setCvTerminalLogs(prev => [`LOGISTICS: Order ${orderId.substring(0, 5)} delivered successfully!`, ...prev]);
      }, 12000);
      
    } catch (e) {
      console.warn('Firebase delivery writing error, matching local simulation:', e);
      // Local fallback
      setTimeout(() => {
        setOrderState('delivering');
      }, 4000);
      setTimeout(() => {
        setOrderState('arrived');
        setCart([]);
        if (currentUser) {
          fetchUserHistory(currentUser.uid);
        }
      }, 12000);
    }
  };

  return (
    <div className="warp-responsive-container">
      
      {/* LEFT COLUMN: Sidebar (Control Center) */}
      <div className="sidebar-panel">
        
        {/* Header */}
        <header className="app-top-header">
          <div className="logo-section">
            <button className="header-back-btn" onClick={() => window.location.href = 'https://koneacademy.io'} aria-label="Back to Hub">
              <ArrowLeft size={16} />
            </button>
            {activeTab === 'ride' && <img src="/logos/logo.svg" className="logo-sparkle" style={{ width: '20px', height: '20px', objectFit: 'contain' }} alt="Kone Warp Logo" />}
            {activeTab === 'delivery' && <ShoppingBag className="logo-sparkle" size={18} />}
            {activeTab === 'vision' && <Camera className="logo-sparkle" size={18} />}
            {activeTab === 'activity' && <Activity className="logo-sparkle" size={18} />}
            <h1>
              {activeTab === 'ride' && 'Kone Warp'}
              {activeTab === 'delivery' && 'Warp Market'}
              {activeTab === 'vision' && 'OpenCV HUD'}
              {activeTab === 'activity' && 'Warp Telemetry'}
            </h1>
          </div>

          <div className="header-actions">
            {activeTab === 'delivery' && (
              <div className="cart-badge-trigger" onClick={() => setDrawerOpen(true)}>
                <ShoppingBag size={18} />
                {cart.length > 0 && <span className="cart-count">{cart.reduce((a,i)=>a+i.qty,0)}</span>}
              </div>
            )}
            {activeTab === 'vision' && (
              <div className="cv-load-indicator">
                <Cpu size={12} />
                <span>FPS: {cvFPS}</span>
              </div>
            )}
            {activeTab === 'activity' && (
              <div className="status-bar-right">
                <Wifi size={14} className="icon-wifi" />
                <Battery size={16} className="icon-battery" />
              </div>
            )}
            <button 
              className={`profile-btn ${currentUser ? 'authenticated' : ''}`} 
              onClick={() => {
                if (!currentUser) {
                  setAuthMode('login');
                  setAuthError('');
                }
                setShowAuthModal(true);
              }}
              aria-label="Profile"
            >
              {currentUser ? <span className="auth-indicator-dot"></span> : null}
              <User size={16} />
            </button>
          </div>
        </header>

        {/* Sidebar scroll content */}
        <div className="sidebar-scroll-content">
          
          {/* TAB 1: RIDESHARE CONTROLS */}
          {activeTab === 'ride' && (
            <div className="ride-controls-panel">
              {rideState === 'idle' && (
                <>
                  <h2 className="panel-title">Where are we warping to?</h2>
                  
                  <div className="route-picker">
                    <div className="route-node autocomplete-container">
                      <MapPin className="pin-pickup" size={16} />
                      <input 
                        type="text"
                        placeholder="Pickup address..."
                        value={pickupQuery}
                        onChange={(e) => setPickupQuery(e.target.value)}
                        onFocus={() => {
                          if (pickupQuery === pickup.name) {
                            setPickupQuery('');
                          }
                        }}
                        onBlur={() => {
                          setTimeout(() => {
                            setPickupQuery(pickup.name);
                            setPickupSuggestions([]);
                          }, 200);
                        }}
                      />
                      {isLoadingPickup && <span className="input-loading-spinner"></span>}
                      {pickupSuggestions.length > 0 && (
                        <ul className="autocomplete-suggestions">
                          {pickupSuggestions.map((item, idx) => (
                            <li 
                              key={idx} 
                              onMouseDown={() => {
                                setPickup(item);
                                setPickupQuery(item.name);
                                setPickupSuggestions([]);
                              }}
                            >
                              {item.name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    
                    <div className="route-connector"></div>
                    
                    <div className="route-node autocomplete-container">
                      <MapPin className="pin-dropoff" size={16} />
                      <input 
                        type="text"
                        placeholder="Dropoff address..."
                        value={dropoffQuery}
                        onChange={(e) => setDropoffQuery(e.target.value)}
                        onFocus={() => {
                          if (dropoffQuery === dropoff.name) {
                            setDropoffQuery('');
                          }
                        }}
                        onBlur={() => {
                          setTimeout(() => {
                            setDropoffQuery(dropoff.name);
                            setDropoffSuggestions([]);
                          }, 200);
                        }}
                      />
                      {isLoadingDropoff && <span className="input-loading-spinner"></span>}
                      {dropoffSuggestions.length > 0 && (
                        <ul className="autocomplete-suggestions">
                          {dropoffSuggestions.map((item, idx) => (
                            <li 
                              key={idx} 
                              onMouseDown={() => {
                                setDropoff(item);
                                setDropoffQuery(item.name);
                                setDropoffSuggestions([]);
                              }}
                            >
                              {item.name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className="route-stats">
                    <div className="stat-pill">
                      <Navigation size={12} />
                      <span>{distance} km</span>
                    </div>
                    <div className="stat-pill">
                      <Clock size={12} />
                      <span>~{rideEta} mins</span>
                    </div>
                  </div>

                  <div className="vehicle-selection">
                    <h3 className="section-subtitle">Select Warp Mode</h3>
                    <div className="vehicle-list">
                      {VEHICLES.map(v => {
                        const IconComp = v.icon;
                        const isSelected = selectedVehicle.id === v.id;
                        const estPrice = (v.basePrice + (distance * v.perKm)).toFixed(2);
                        return (
                          <div 
                            key={v.id} 
                            className={`vehicle-card ${isSelected ? 'selected' : ''}`}
                            style={{ '--glow-color': v.glow }}
                            onClick={() => setSelectedVehicle(v)}
                          >
                            <div className="vehicle-icon-wrapper">
                              <IconComp size={22} />
                            </div>
                            <div className="vehicle-info">
                              <span className="vehicle-name">{v.name}</span>
                              <span className="vehicle-desc">{v.type} • {v.co2}g CO2</span>
                            </div>
                            <div className="vehicle-price">
                              <span>₵{estPrice}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <button className="btn-primary" onClick={handleBooking}>
                    <span>Confirm Warp Drive</span>
                    <ArrowRight size={18} />
                  </button>
                </>
              )}

              {rideState === 'matching' && (
                <div className="text-center py-6">
                  <div className="matching-spinner">
                    <div className="double-bounce1"></div>
                    <div className="double-bounce2"></div>
                  </div>
                  <h3 className="matching-title">Matching with nearest driver...</h3>
                  <p className="matching-sub">Negotiating automated pricing with EV Nodes.</p>
                  <button className="btn-secondary mt-4" onClick={handleResetRide}>
                    Cancel Request
                  </button>
                </div>
              )}

              {rideState === 'booked' && (
                <div>
                  <div className="success-banner">
                    <ShieldCheck size={20} />
                    <span>WARP AGENT DISPATCHED</span>
                  </div>

                  <div className="driver-panel">
                    <div className="driver-avatar-wrapper">
                      <div className="avatar-placeholder">🤖</div>
                    </div>
                    <div className="driver-meta">
                      <span className="driver-name">Warp Agent Alpha</span>
                      <span className="vehicle-plate">KONE-EV-09X ({selectedVehicle.name})</span>
                    </div>
                    <div className="driver-rating">
                      <span>★ 5.0</span>
                    </div>
                  </div>

                  <div className="trip-status">
                    <div className="status-row">
                      <span>Eta to Pickup</span>
                      <span className="highlight-text">2 mins</span>
                    </div>
                    <div className="status-row">
                      <span>Automatic Fare Secured</span>
                      <span className="fare-badge">₵{ridePrice}</span>
                    </div>
                    <div className="progress-bar-container">
                      <div 
                        className="progress-bar-fill" 
                        style={{ width: `${driverProgress}%`, background: selectedVehicle.glow }}
                      ></div>
                    </div>
                  </div>

                  <button className="btn-secondary" onClick={handleResetRide}>
                    Cancel Ride
                  </button>
                </div>
              )}

              {rideState === 'completed' && (
                <div className="text-center">
                  <div className="completion-icon">🎉</div>
                  <h3 className="matching-title">You have arrived at warp speed!</h3>
                  <p className="matching-sub">Your trip fare of ₵{ridePrice} was processed.</p>
                  <div className="rating-selector mt-4">
                    <span>Rate your experience:</span>
                    <div className="stars">⭐⭐⭐⭐⭐</div>
                  </div>
                  <button className="btn-primary mt-6" onClick={handleResetRide}>
                    Book Another Ride
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CART PANEL */}
          {activeTab === 'delivery' && (
            <div className="delivery-cart-panel">
              <h2 className="panel-title">Warp Basket</h2>
              {cart.length === 0 ? (
                <div className="empty-cart-view">
                  <span className="empty-basket-icon">🧺</span>
                  <p>Your basket is empty. Add agritech items from the Volta catalog.</p>
                </div>
              ) : (
                <div className="cart-items-panel">
                  <div className="cart-items-list">
                    {cart.map(i => (
                      <div key={i.id} className="cart-item-row">
                        <span className="cart-item-emoji">{i.image}</span>
                        <div className="cart-item-info">
                          <span className="cart-item-name">{i.name}</span>
                          <span className="cart-item-price">₵{(i.price * i.qty).toFixed(2)}</span>
                        </div>
                        <div className="cart-qty-ctrl">
                          <button onClick={() => updateQty(i.id, -1)}><Minus size={12} /></button>
                          <span>{i.qty}</span>
                          <button onClick={() => updateQty(i.id, 1)}><Plus size={12} /></button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="delivery-speed-selector">
                    <h4>Delivery Fleet</h4>
                    <div className="speed-pills">
                      <button 
                        className={`speed-pill ${deliverySpeed === 'standard' ? 'active' : ''}`}
                        onClick={() => setDeliverySpeed('standard')}
                      >
                        <span>Standard</span>
                        <span className="speed-meta">~25m • ₵8.00</span>
                      </button>
                      <button 
                        className={`speed-pill ${deliverySpeed === 'warp' ? 'active' : ''}`}
                        onClick={() => setDeliverySpeed('warp')}
                      >
                        <span>Warp Speed</span>
                        <span className="speed-meta">~10m • ₵15.00</span>
                      </button>
                    </div>
                  </div>

                  <div className="pricing-breakdown">
                    <div className="price-row">
                      <span>Subtotal</span>
                      <span>₵{getCartTotal().subtotal.toFixed(2)}</span>
                    </div>
                    <div className="price-row">
                      <span>Delivery fee</span>
                      <span>₵{getCartTotal().fee.toFixed(2)}</span>
                    </div>
                    <div className="price-row total-row">
                      <span>Total</span>
                      <span>₵{getCartTotal().total.toFixed(2)}</span>
                    </div>
                  </div>

                  <button className="btn-primary mt-4" onClick={submitOrder}>
                    <span>Place Warp Order</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CV CONFIG */}
          {activeTab === 'vision' && (
            <div className="vision-config-panel">
              <h2 className="panel-title">OpenCV Config</h2>
              <div className="diagnostics-panel">
                <div className="diagnostics-header">
                  <h3>Computer Vision Mode</h3>
                  <button 
                    className={`btn-toggle ${cvActive ? 'active' : ''}`}
                    onClick={() => setCvActive(!cvActive)}
                  >
                    {cvActive ? 'ACTIVE' : 'PAUSED'}
                  </button>
                </div>
                <div className="diagnostics-controls-grid">
                  <button 
                    className={`diag-btn ${cvScanner ? 'active' : ''}`}
                    onClick={() => setCvScanner(!cvScanner)}
                  >
                    <Scan size={14} />
                    <span>Laser Grid</span>
                  </button>
                  <button 
                    className={`diag-btn ${cvDistance ? 'active' : ''}`}
                    onClick={() => setCvDistance(!cvDistance)}
                  >
                    <Eye size={14} />
                    <span>LiDAR Dist</span>
                  </button>
                </div>
              </div>

              <div className="cv-terminal-output mt-4">
                <div className="terminal-title">Telemetry Console Output</div>
                <div className="terminal-logs">
                  {cvTerminalLogs.map((log, index) => (
                    <div key={index} className="terminal-log-line">
                      <span className="terminal-prompt">&gt;</span>
                      <span className="terminal-log-text">{log}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TELEMETRY NODES */}
          {activeTab === 'activity' && (
            <div className="telemetry-config-panel">
              {currentUser ? (
                <div className="user-profile-section mb-4">
                  <h2 className="panel-title">Active User Session</h2>
                  <div className="user-profile-card">
                    <span className="user-profile-avatar">👤</span>
                    <div className="user-profile-details">
                      <span className="user-email-text">{currentUser.email}</span>
                      <span className="user-uid-text">UID: {currentUser.uid.substring(0, 8)}...</span>
                    </div>
                  </div>
                  <div className="user-history-stats mt-3">
                    <div className="history-stat-box">
                      <span className="history-stat-val">{userRides.length}</span>
                      <span className="history-stat-lbl">Booked Rides</span>
                    </div>
                    <div className="history-stat-box">
                      <span className="history-stat-val">{userDeliveries.length}</span>
                      <span className="history-stat-lbl">Market Orders</span>
                    </div>
                  </div>
                  <button className="btn-secondary btn-sm mt-3" onClick={handleLogout}>
                    Sign Out
                  </button>
                </div>
              ) : (
                <div className="user-profile-section offline mb-4">
                  <h2 className="panel-title">Account History</h2>
                  <div className="auth-sync-promo-card">
                    <p>Log in to link and sync your rideshare bookings and agritech orders across devices.</p>
                    <button className="btn-primary btn-sm mt-2" onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}>
                      Sign In to Sync
                    </button>
                  </div>
                </div>
              )}

              <h2 className="panel-title mt-4">System Nodes</h2>
              
              <div className="diagnostics-list-panel">
                {telemetryNodes.map(node => (
                  <div key={node.id} className="diagnostics-node-row">
                    <div className={`node-avatar ${
                      node.id.includes('ev') ? 'bg-green' : 
                      node.id.includes('comfort') ? 'bg-purple' : 'bg-cyan'
                    }`}>
                      {node.id.includes('ev') ? 'EV' : node.id.includes('comfort') ? 'Comfort' : 'Jet'}
                    </div>
                    <div className="node-stats">
                      <div className="node-name-row">
                        <span className="node-name">{node.nodeName}</span>
                        <span className={`node-status-tag ${node.status}`}>{node.status}</span>
                      </div>
                      <div className="node-metrics-bar">
                        <span>Charge/Battery: {node.batteryPercent}%</span>
                        <span>Temp: {node.temperatureC}°C</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Tab Navbar */}
        <nav className="app-bottom-navbar">
          <button 
            className={`navbar-tab-item ${activeTab === 'ride' ? 'active' : ''}`}
            onClick={() => { setActiveTab('ride'); setDrawerOpen(true); }}
            aria-label="Warp Ride"
          >
            <Navigation size={20} />
            <span>Warp Ride</span>
          </button>
          <button 
            className={`navbar-tab-item ${activeTab === 'delivery' ? 'active' : ''}`}
            onClick={() => { setActiveTab('delivery'); setDrawerOpen(false); }}
            aria-label="Warp Market"
          >
            <ShoppingBag size={20} />
            <span>Market</span>
          </button>
          <button 
            className={`navbar-tab-item ${activeTab === 'vision' ? 'active' : ''}`}
            onClick={() => { setActiveTab('vision'); }}
            aria-label="OpenCV Vision"
          >
            <Camera size={20} />
            <span>CV Vision</span>
          </button>
          <button 
            className={`navbar-tab-item ${activeTab === 'activity' ? 'active' : ''}`}
            onClick={() => { setActiveTab('activity'); }}
            aria-label="Telemetry Activity"
          >
            <Activity size={20} />
            <span>Telemetry</span>
          </button>
        </nav>

      </div>

      {/* RIGHT COLUMN: Visual Main Viewport */}
      <main className="main-viewport">
        
        {/* Ride tab: Real Leaflet Map */}
        {activeTab === 'ride' && (
          <div className="viewport-overlay-wrap">
            <div id="map-container" style={{ width: '100%', height: '100%' }}></div>

            <div className="floating-hud">
              <div className="hud-metric">
                <Compass className="icon-spin" size={14} />
                <span>REAL GPS MAP ENGINE</span>
              </div>
              {rideState === 'booked' && (
                <div className="hud-metric alert">
                  <span className="live-dot pulse"></span>
                  <span>DRIVER EN ROUTE ({driverProgress}%)</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Delivery tab: volta shelf */}
        {activeTab === 'delivery' && (
          <div className="products-viewport-catalog scrollable-content">
            <div className="market-intro">
              <h2>Direct Volta Agritech Shelf</h2>
              <p>Sourcing organic Scotch Bonnet peppers, shallots, garlic, smoked herring, and dried shrimp directly from Volta Region family farms.</p>
            </div>

            <div className="market-grid">
              {MARKET_ITEMS.map(item => (
                <div key={item.id} className="market-card">
                  <div className="item-image">{item.image}</div>
                  <div className="item-info">
                    <div className="item-header">
                      <span className="item-title">{item.name}</span>
                      <span className="item-rating">★ {item.rating}</span>
                    </div>
                    <p className="item-desc">{item.desc}</p>
                    <div className="item-footer">
                      <span className="item-price">₵{item.price.toFixed(2)}</span>
                      <button className="btn-add-cart" onClick={() => addToCart(item)}>
                        <Plus size={14} /> Add to Basket
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Mobile Cart Drawer Trigger */}
            {drawerOpen && (
              <div className="cart-drawer-overlay mobile-only" onClick={() => setDrawerOpen(false)}>
                <div className="cart-drawer" onClick={(e) => e.stopPropagation()}>
                  <div className="cart-header">
                    <h3>Basket</h3>
                    <button className="btn-close-cart" onClick={() => setDrawerOpen(false)}>×</button>
                  </div>

                  {cart.length === 0 ? (
                    <div className="empty-cart-view">
                      <span className="empty-basket-icon">🧺</span>
                      <p>Your basket is empty.</p>
                    </div>
                  ) : (
                    <div className="cart-items-panel">
                      <div className="cart-items-list">
                        {cart.map(i => (
                          <div key={i.id} className="cart-item-row">
                            <span className="cart-item-emoji">{i.image}</span>
                            <div className="cart-item-info">
                              <span className="cart-item-name">{i.name}</span>
                              <span className="cart-item-price">₵{(i.price * i.qty).toFixed(2)}</span>
                            </div>
                            <div className="cart-qty-ctrl">
                              <button onClick={() => updateQty(i.id, -1)}><Minus size={12} /></button>
                              <span>{i.qty}</span>
                              <button onClick={() => updateQty(i.id, 1)}><Plus size={12} /></button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="delivery-speed-selector">
                        <h4>Delivery Fleet</h4>
                        <div className="speed-pills">
                          <button 
                            className={`speed-pill ${deliverySpeed === 'standard' ? 'active' : ''}`}
                            onClick={() => setDeliverySpeed('standard')}
                          >
                            <span>Standard (₵8.0)</span>
                          </button>
                          <button 
                            className={`speed-pill ${deliverySpeed === 'warp' ? 'active' : ''}`}
                            onClick={() => setDeliverySpeed('warp')}
                          >
                            <span>Warp Speed (₵15.0)</span>
                          </button>
                        </div>
                      </div>

                      <div className="pricing-breakdown">
                        <div className="price-row total-row">
                          <span>Total</span>
                          <span>₵{getCartTotal().total.toFixed(2)}</span>
                        </div>
                      </div>

                      <button className="btn-primary mt-4" onClick={submitOrder}>
                        <span>Place Warp Order</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Vision tab: Live CV camera viewfinder */}
        {activeTab === 'vision' && (
          <div className="camera-viewport">
            <div className="camera-viewfinder">
              <video ref={videoRef} className="camera-video-stream" playsInline autoPlay muted />
              <div className="viewfinder-lens">
                <div className="cv-crosshair"></div>
                <div className="cv-box-corner top-left"></div>
                <div className="cv-box-corner top-right"></div>
                <div className="cv-box-corner bottom-left"></div>
                <div className="cv-box-corner bottom-right"></div>

                {cvActive && cvObjects.map((obj, i) => (
                  <div 
                    key={i} 
                    className="cv-bounding-box"
                    style={{ 
                      left: `${obj.x}px`, 
                      top: `${obj.y}px`,
                      borderColor: obj.color,
                      boxShadow: `0 0 8px ${obj.color}`
                    }}
                  >
                    <div className="cv-tag" style={{ background: obj.color }}>
                      <span>{obj.label}</span>
                      <span>{(obj.conf * 100).toFixed(0)}%</span>
                    </div>
                    {cvDistance && <div className="cv-distance-tag">{obj.dist}</div>}
                  </div>
                ))}

                {cvScanner && <div className="cv-laser-bar"></div>}
              </div>
            </div>
          </div>
        )}

        {/* Activity tab: detailed telemetry logs */}
        {activeTab === 'activity' && (
          <div className="telemetry-viewport scrollable-content">
            <div className="telemetry-overview">
              <div className="overview-card">
                <span className="card-label">CO2 Saved Today</span>
                <span className="card-value">12.4 kg</span>
                <span className="card-meta green">↑ 14% vs yesterday</span>
              </div>
              <div className="overview-card">
                <span className="card-label">Warp Rides Completed</span>
                <span className="card-value">148</span>
                <span className="card-meta">Live operations database logs</span>
              </div>
            </div>

            {currentUser && (userRides.length > 0 || userDeliveries.length > 0) ? (
              <div className="recent-activity-section">
                <h3>Your Synced Drive Logs</h3>
                {userRides.map(ride => (
                  <div key={ride.id} className="activity-item-log">
                    <div className="log-icon">🚗</div>
                    <div className="log-meta">
                      <span className="log-title">{ride.pickup.name} to {ride.dropoff.name}</span>
                      <span className="log-time">
                        Status: <strong style={{ color: ride.status === 'completed' ? '#10b981' : '#fbbf24' }}>{ride.status.toUpperCase()}</strong> • {ride.vehicleName}
                      </span>
                    </div>
                    <span className="log-price">₵{ride.fareGHS.toFixed(2)}</span>
                  </div>
                ))}
                {userDeliveries.map(order => (
                  <div key={order.id} className="activity-item-log">
                    <div className="log-icon">📦</div>
                    <div className="log-meta">
                      <span className="log-title">Order of {order.items.length} agritech items</span>
                      <span className="log-time">
                        Status: <strong style={{ color: order.status === 'arrived' ? '#10b981' : '#fbbf24' }}>{order.status.toUpperCase()}</strong> • Speed: {order.speed}
                      </span>
                    </div>
                    <span className="log-price">₵{order.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="recent-activity-section">
                <h3>Global Warp Drive Logs</h3>
                <div className="activity-item-log">
                  <div className="log-icon">🏍️</div>
                  <div className="log-meta">
                    <span className="log-title">Delivery arrived at Legon</span>
                    <span className="log-time">12 mins ago • EV Warp Bike</span>
                  </div>
                  <span className="log-price">₵22.00</span>
                </div>
                <div className="activity-item-log">
                  <div className="log-icon">🚗</div>
                  <div className="log-meta">
                    <span className="log-title">Warp Comfort Ride</span>
                    <span className="log-time">1 hour ago • Airport to Hub</span>
                  </div>
                  <span className="log-price">₵45.00</span>
                </div>
                {!currentUser && (
                  <div className="history-offline-notice" style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px dashed var(--color-border)', color: 'var(--color-text-secondary)', fontSize: '11px', textAlign: 'center', marginTop: '16px' }}>
                    <span>💡 Sign in to view and search your personalized transaction and telemetry logs.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Checkout status alerts */}
        {orderState !== 'idle' && (
          <div className="order-status-modal">
            <div className="status-box">
              <div className="status-glow-ring pulse"></div>
              <h3>Warp Order Status</h3>
              
              <div className="status-progress-flow">
                <div className={`step-node ${orderState === 'ordered' || orderState === 'delivering' || orderState === 'arrived' ? 'done' : ''}`}>
                  <div className="node-icon"><Check size={10} /></div>
                  <span>Processing</span>
                </div>
                <div className="step-bar"></div>
                <div className={`step-node ${orderState === 'delivering' || orderState === 'arrived' ? 'done' : ''}`}>
                  <div className="node-icon"><Bike size={10} /></div>
                  <span>En Route</span>
                </div>
                <div className="step-bar"></div>
                <div className={`step-node ${orderState === 'arrived' ? 'done' : ''}`}>
                  <div className="node-icon"><Check size={10} /></div>
                  <span>Arrived</span>
                </div>
              </div>

              <div className="eta-block">
                <span className="eta-title">ESTIMATED DELIVERY</span>
                <span className="eta-value">
                  {orderState === 'arrived' ? 'DELIVERED' : `~${deliverySpeed === 'warp' ? 10 : 22} mins`}
                </span>
              </div>

              {orderState === 'arrived' && (
                <button className="btn-primary mt-6" onClick={() => setOrderState('idle')}>
                  Dismiss
                </button>
              )}
            </div>
          </div>
        )}

      </main>

      {/* AUTH MODAL / PROFILE CARD */}
      {showAuthModal && (
        <div className="auth-modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="auth-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="auth-modal-close" onClick={() => setShowAuthModal(false)}>×</button>
            
            {currentUser ? (
              <div className="profile-view-card">
                <div className="profile-icon-large">👤</div>
                <h3>Active Warp Session</h3>
                <p className="profile-email">{currentUser.email}</p>
                <div className="profile-details-list">
                  <div className="profile-detail-row">
                    <span>Account ID</span>
                    <span className="mono-text">{currentUser.uid.substring(0, 8)}...</span>
                  </div>
                  <div className="profile-detail-row">
                    <span>Auth Provider</span>
                    <span>Firebase Secure Auth</span>
                  </div>
                </div>
                <button className="btn-secondary logout-btn" onClick={() => { handleLogout(); setShowAuthModal(false); }}>
                  Log Out
                </button>
              </div>
            ) : (
              <div className="auth-form-wrapper">
                <h3>{authMode === 'login' ? 'Access Warp Control' : 'Create Warp Account'}</h3>
                <p className="auth-subtitle">
                  {authMode === 'login' ? 'Sign in to access secure telemetry and order syncing.' : 'Register to track automated rides and agritech orders.'}
                </p>
                
                {authError && <div className="auth-error-alert">{authError}</div>}
                
                <form onSubmit={handleAuthSubmit} className="auth-form">
                  <div className="auth-input-group">
                    <label>Email Address</label>
                    <input 
                      type="email" 
                      placeholder="name@koneacademy.io" 
                      value={authEmail} 
                      onChange={(e) => setAuthEmail(e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="auth-input-group">
                    <label>Password</label>
                    <input 
                      type="password" 
                      placeholder="••••••••" 
                      value={authPassword} 
                      onChange={(e) => setAuthPassword(e.target.value)} 
                      required 
                    />
                  </div>
                  <button type="submit" className="btn-primary auth-submit-btn" disabled={authLoading}>
                    {authLoading ? 'Verifying Credentials...' : authMode === 'login' ? 'Sign In' : 'Sign Up'}
                  </button>
                </form>
                
                <div className="auth-mode-toggle">
                  {authMode === 'login' ? (
                    <span>New to Kone Warp? <button onClick={() => { setAuthMode('signup'); setAuthError(''); }}>Create an account</button></span>
                  ) : (
                    <span>Already have an account? <button onClick={() => { setAuthMode('login'); setAuthError(''); }}>Sign in</button></span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
