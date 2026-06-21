import { db } from '../firebase/config';
import { 
  collection, addDoc, doc, updateDoc, onSnapshot, 
  serverTimestamp, setDoc, getDocs, getDoc, query, where
} from 'firebase/firestore';

// 1. Create a new Rideshare request in Firestore
export async function createRideRecord(pickup, dropoff, fare, distance, vehicle, uid = null) {
  if (!db || !db.app) {
    console.warn('Firebase DB not initialized. Simulating booking locally.');
    return null;
  }
  
  try {
    const docRef = await addDoc(collection(db, 'rides'), {
      uid,
      pickup: {
        name: pickup.name,
        lat: pickup.coords.lat || 5.6145, // default to Accra Hub
        lng: pickup.coords.lng || -0.1872
      },
      dropoff: {
        name: dropoff.name,
        lat: dropoff.coords.lat || 5.6322,
        lng: dropoff.coords.lng || -0.1654
      },
      fareGHS: fare,
      distanceKm: distance,
      vehicleId: vehicle.id,
      vehicleName: vehicle.name,
      status: 'matching',
      driverId: null,
      driverCoords: null,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating ride record in Firestore:', error);
    throw error;
  }
}

// 2. Update ride status (e.g. matching -> booked -> completed)
export async function updateRideStatus(rideId, status, driverData = {}) {
  if (!db || !db.app || !rideId) return;
  
  try {
    const rideRef = doc(db, 'rides', rideId);
    const updateData = { status, ...driverData };
    if (status === 'completed') {
      updateData.completedAt = serverTimestamp();
    }
    await updateDoc(rideRef, updateData);
  } catch (error) {
    console.error('Error updating ride status in Firestore:', error);
  }
}

// 3. Create a new volta market delivery order
export async function createDeliveryOrder(cart, subtotal, fee, total, speed, uid = null) {
  if (!db || !db.app) {
    console.warn('Firebase DB not initialized. Simulating order placement.');
    return null;
  }

  try {
    const items = cart.map(item => ({
      itemId: item.id,
      name: item.name,
      price: item.price,
      qty: item.qty
    }));

    const docRef = await addDoc(collection(db, 'deliveries'), {
      uid,
      items,
      subtotal,
      deliveryFee: fee,
      total,
      speed,
      status: 'ordered',
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating delivery order in Firestore:', error);
    throw error;
  }
}

// 4. Update delivery order status
export async function updateDeliveryStatus(orderId, status) {
  if (!db || !db.app || !orderId) return;
  try {
    const orderRef = doc(db, 'deliveries', orderId);
    await updateDoc(orderRef, { status });
  } catch (error) {
    console.error('Error updating delivery status in Firestore:', error);
  }
}

// 5. Initialize telemetry nodes in the database if they do not exist
export async function initializeTelemetryNodes() {
  if (!db || !db.app) return;
  
  const nodes = [
    { id: 'node_ev_04', nodeName: 'Warp Bike Node-04', batteryPercent: 84, temperatureC: 32, status: 'online', lat: 5.6145, lng: -0.1872 },
    { id: 'node_comfort_12', nodeName: 'Sedan Comfort Node-12', batteryPercent: 62, temperatureC: 38, status: 'online', lat: 5.6322, lng: -0.1654 },
    { id: 'node_drone_01', nodeName: 'Supersonic Drone-01', batteryPercent: 100, temperatureC: 22, status: 'standby', lat: 5.6012, lng: -0.1711 }
  ];

  try {
    for (const node of nodes) {
      const nodeRef = doc(db, 'telemetry', node.id);
      const snapshot = await getDoc(nodeRef);
      if (!snapshot.exists()) {
        await setDoc(nodeRef, {
          nodeName: node.nodeName,
          batteryPercent: node.batteryPercent,
          temperatureC: node.temperatureC,
          status: node.status,
          currentCoords: {
            lat: node.lat,
            lng: node.lng
          },
          updatedAt: serverTimestamp()
        });
      }
    }
  } catch (error) {
    console.error('Error initializing telemetry nodes:', error);
  }
}

// 6. Listen to real-time telemetry nodes from Firestore
export function listenToTelemetryNodes(onUpdate) {
  if (!db || !db.app) {
    console.warn('Firebase DB not initialized. Using static telemetry stream.');
    return () => {}; // return empty unsubscribe function
  }

  const q = collection(db, 'telemetry');
  return onSnapshot(q, (snapshot) => {
    const nodes = [];
    snapshot.forEach((doc) => {
      nodes.push({ id: doc.id, ...doc.data() });
    });
    onUpdate(nodes);
  }, (error) => {
    console.error('Error listening to telemetry nodes in Firestore:', error);
  });
}

// 7. Get user ride history
export async function getUserRideHistory(uid) {
  if (!db || !db.app || !uid) return [];
  try {
    const q = query(collection(db, 'rides'), where('uid', '==', uid));
    const querySnapshot = await getDocs(q);
    const rides = [];
    querySnapshot.forEach((doc) => {
      rides.push({ id: doc.id, ...doc.data() });
    });
    // Sort in memory by createdAt descending
    rides.sort((a, b) => {
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      return bTime - aTime;
    });
    return rides;
  } catch (error) {
    console.error('Error fetching user ride history:', error);
    return [];
  }
}

// 8. Get user delivery history
export async function getUserDeliveryHistory(uid) {
  if (!db || !db.app || !uid) return [];
  try {
    const q = query(collection(db, 'deliveries'), where('uid', '==', uid));
    const querySnapshot = await getDocs(q);
    const deliveries = [];
    querySnapshot.forEach((doc) => {
      deliveries.push({ id: doc.id, ...doc.data() });
    });
    // Sort in memory by createdAt descending
    deliveries.sort((a, b) => {
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      return bTime - aTime;
    });
    return deliveries;
  } catch (error) {
    console.error('Error fetching user delivery history:', error);
    return [];
  }
}
