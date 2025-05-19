import { Client } from "@stomp/stompjs";
import { Camera, CameraView } from "expo-camera";
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function App() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [barcodeData, setBarcodeData] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [stompClient, setStompClient] = useState<Client>();
  const [scannedItems, setScannedItems] = useState<string[]>([]); // Track scanned items

  const isHandlingScan = useRef(false);

  useEffect(() => {
    const client = new Client({
      brokerURL: "ws://192.168.10.9:8080/ws-mobile",
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      debug: function (str) {
        console.log("STOMP: " + str);
      },
      connectHeaders: {
        host: "192.168.10.9",
      },
      forceBinaryWSFrames: true,
      appendMissingNULLonIncoming: true,
    });

    client.onConnect = () => {
      console.log("WebSocket Connected");
      setIsConnected(true);
    };

    client.onDisconnect = () => {
      console.log("WebSocket Disconnected");
      setIsConnected(false);
    };

    client.onWebSocketError = (error) => {
      console.error("WebSocket error", error);
    };

    client.onStompError = (frame) => {
      console.error("Broker reported error: " + frame.headers["message"]);
      console.error("Additional details: " + frame.body);
    };

    client.activate();
    setStompClient(client);

    return () => {
      client.deactivate();
    };
  }, []);

  useEffect(() => {
    const getBarCodeScannerPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    };
    getBarCodeScannerPermissions();
  }, []);

  const handleBarCodeScanned = ({
    type,
    data,
  }: {
    type: string;
    data: string;
  }) => {
    if (isHandlingScan.current) return;
    isHandlingScan.current = true;

    setScanned(true);
    setBarcodeData(data);
    setScannedItems((prev) => [...prev, data]); // Add to scanned items list

    if (stompClient && isConnected) {
      stompClient.publish({
        destination: "/app/barcode/send",
        body: data,
      });
      console.log("Barcode sent:", data);
    } else {
      console.warn("WebSocket not connected. Barcode not sent.");
    }

    // Reset after a short delay to allow new scans
    setTimeout(() => {
      setScanned(false);
      isHandlingScan.current = false;
    }, 1000);
  };

  const startScanning = () => {
    setScanned(false);
    setScannedItems([]); // Clear previous scans
    isHandlingScan.current = false;
    setShowScanner(true);
  };

  const stopScanning = () => {
    setShowScanner(false);
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Text>Requesting for camera permission</Text>
      </View>
    );
  }
  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>No access to camera</Text>
        <Text style={styles.permissionSubtext}>
          Please enable camera permissions in your device settings
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showScanner ? (
        <View style={styles.scannerContainer}>
          <CameraView
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.scannerOverlay}>
            <TouchableOpacity style={styles.stopButton} onPress={stopScanning}>
              <Text style={styles.stopButtonText}>Stop Scanning</Text>
            </TouchableOpacity>
            <View style={styles.scannedItemsContainer}>
              {scannedItems.map((item, index) => (
                <Text key={index} style={styles.scannedItem}>
                  Scanned: {item}
                </Text>
              ))}
            </View>
          </View>
        </View>
      ) : (
        <>
          <Text style={styles.title}>Barcode Scanner App</Text>
          <TouchableOpacity style={styles.button} onPress={startScanning}>
            <Text style={styles.buttonText}>Start Scanning</Text>
          </TouchableOpacity>
          {scannedItems.length > 0 && (
            <View style={styles.resultsContainer}>
              <Text style={styles.resultsTitle}>Last Scan:</Text>
              <Text style={styles.resultsText}>{barcodeData}</Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  scannerContainer: {
    flex: 1,
    width: "100%",
    position: "relative",
  },
  scannerOverlay: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 30,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 10,
    width: "80%",
    alignItems: "center",
    marginBottom: 20,
  },
  stopButton: {
    backgroundColor: "#FF3B30",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 10,
    width: "80%",
    alignItems: "center",
    marginBottom: 20,
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  stopButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  permissionText: {
    fontSize: 18,
    color: "red",
    marginBottom: 10,
  },
  permissionSubtext: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  scannedItemsContainer: {
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 10,
    borderRadius: 5,
    maxHeight: 150,
    width: "90%",
  },
  scannedItem: {
    color: "white",
    marginVertical: 2,
  },
  resultsContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: "#f0f0f0",
    borderRadius: 10,
    width: "100%",
    alignItems: "center",
  },
  resultsTitle: {
    fontWeight: "bold",
    marginBottom: 5,
  },
  resultsText: {
    fontSize: 16,
  },
});
