import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar } from 'recharts';
import { Mic, MicOff, Wifi, WifiOff, Activity, Server, User } from 'lucide-react';

const RadioCommAnalyzer = () => {
  const [mode, setMode] = useState(''); // 'server' or 'client'
  const [serverAddress, setServerAddress] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [remoteTransmitting, setRemoteTransmitting] = useState(false);
  const [frequency, setFrequency] = useState(0);
  const [remoteFrequency, setRemoteFrequency] = useState(0);
  const [signalStrength, setSignalStrength] = useState(0);
  const [remoteSignalStrength, setRemoteSignalStrength] = useState(0);
  const [noiseLevel, setNoiseLevel] = useState(0);
  const [snr, setSnr] = useState(0);
  const [frequencyData, setFrequencyData] = useState([]);
  const [remoteFrequencyData, setRemoteFrequencyData] = useState([]);
  const [signalHistory, setSignalHistory] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('');
  
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const animationFrameRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    stopTransmission();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };

  const startAsServer = () => {
    setMode('server');
    setConnectionStatus('Server rejimida kutilmoqda...');
    setupWebRTCServer();
  };

  const startAsClient = () => {
    if (!serverAddress.trim()) {
      alert('Iltimos, server manzilini kiriting! (masalan: 192.168.1.5)');
      return;
    }
    setMode('client');
    setConnectionStatus('Serverga ulanilmoqda...');
    connectToServer();
  };

  const setupWebRTCServer = async () => {
    try {
      // Simulate WebRTC server setup
      const config = {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      };
      
      peerConnectionRef.current = new RTCPeerConnection(config);
      
      // Create data channel for signal data
      dataChannelRef.current = peerConnectionRef.current.createDataChannel('signalData');
      
      dataChannelRef.current.onopen = () => {
        setIsConnected(true);
        setConnectionStatus('Client ulandi!');
      };
      
      dataChannelRef.current.onmessage = (event) => {
        handleRemoteData(JSON.parse(event.data));
      };

      peerConnectionRef.current.oniceconnectionstatechange = () => {
        const state = peerConnectionRef.current.iceConnectionState;
        setConnectionStatus(`Aloqa holati: ${state}`);
        if (state === 'connected') {
          setIsConnected(true);
        } else if (state === 'disconnected' || state === 'failed') {
          setIsConnected(false);
        }
      };

      peerConnectionRef.current.ontrack = (event) => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
          remoteAudioRef.current.play();
          analyzeRemoteAudio(event.streams[0]);
        }
      };

      // In real implementation, you would exchange offers/answers via signaling server
      setConnectionStatus(`Server ishga tushdi. IP manzil: ${window.location.hostname || 'localhost'}`);
      
    } catch (err) {
      console.error('Server xatosi:', err);
      alert('Server yaratishda xato yuz berdi!');
    }
  };

  const connectToServer = async () => {
    try {
      const config = {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      };
      
      peerConnectionRef.current = new RTCPeerConnection(config);
      
      peerConnectionRef.current.ondatachannel = (event) => {
        dataChannelRef.current = event.channel;
        
        dataChannelRef.current.onopen = () => {
          setIsConnected(true);
          setConnectionStatus('Serverga muvaffaqiyatli ulandi!');
        };
        
        dataChannelRef.current.onmessage = (event) => {
          handleRemoteData(JSON.parse(event.data));
        };
      };

      peerConnectionRef.current.oniceconnectionstatechange = () => {
        const state = peerConnectionRef.current.iceConnectionState;
        setConnectionStatus(`Aloqa holati: ${state}`);
        if (state === 'connected') {
          setIsConnected(true);
        } else if (state === 'disconnected' || state === 'failed') {
          setIsConnected(false);
        }
      };

      peerConnectionRef.current.ontrack = (event) => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
          remoteAudioRef.current.play();
          analyzeRemoteAudio(event.streams[0]);
        }
      };

      // Simulate connection
      setTimeout(() => {
        setIsConnected(true);
        setConnectionStatus('Ulanish simulyatsiya qilindi (demo rejim)');
      }, 1000);

    } catch (err) {
      console.error('Ulanish xatosi:', err);
      alert('Serverga ulanishda xato yuz berdi!');
    }
  };

  const handleRemoteData = (data) => {
    if (data.type === 'signal') {
      setRemoteFrequency(data.frequency);
      setRemoteSignalStrength(data.signalStrength);
      setRemoteFrequencyData(data.frequencyData);
      setRemoteTransmitting(data.isTransmitting);
    }
  };

  const sendSignalData = (data) => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      dataChannelRef.current.send(JSON.stringify(data));
    }
  };

  const startTransmission = async () => {
    if (!isConnected) {
      alert('Avval ulanish o\'rnating!');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      micStreamRef.current = stream;
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }

      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      analyserRef.current.smoothingTimeConstant = 0.8;
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      // Add stream to peer connection
      if (peerConnectionRef.current) {
        stream.getTracks().forEach(track => {
          peerConnectionRef.current.addTrack(track, stream);
        });
      }
      
      setIsTransmitting(true);
      analyzeAudio();
    } catch (err) {
      console.error('Mikrofon xatosi:', err);
      alert('Mikrofondan foydalanishda xato yuz berdi!');
    }
  };

  const stopTransmission = () => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setIsTransmitting(false);
    setSignalStrength(0);
    setFrequency(0);
    
    sendSignalData({
      type: 'signal',
      isTransmitting: false,
      frequency: 0,
      signalStrength: 0,
      frequencyData: []
    });
  };

  const analyzeAudio = () => {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const timeData = new Uint8Array(bufferLength);
    
    const analyze = () => {
      if (!isTransmitting) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      analyserRef.current.getByteTimeDomainData(timeData);

      let sum = 0;
      for (let i = 0; i < timeData.length; i++) {
        const normalized = (timeData[i] - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / timeData.length);
      const dbValue = 20 * Math.log10(rms + 0.0001);
      const normalizedDb = Math.max(0, Math.min(100, (dbValue + 60) * 1.67));
      
      setSignalStrength(normalizedDb);

      let maxVal = 0;
      let maxIndex = 0;
      for (let i = 0; i < dataArray.length; i++) {
        if (dataArray[i] > maxVal) {
          maxVal = dataArray[i];
          maxIndex = i;
        }
      }
      
      const nyquist = audioContextRef.current.sampleRate / 2;
      const dominantFreq = (maxIndex * nyquist) / bufferLength;
      setFrequency(Math.round(dominantFreq));

      const sortedData = Array.from(dataArray).sort((a, b) => a - b);
      const noiseFloor = sortedData.slice(0, Math.floor(sortedData.length * 0.1)).reduce((a, b) => a + b, 0) / (sortedData.length * 0.1);
      setNoiseLevel(Math.round(noiseFloor));

      const signal = maxVal;
      const snrValue = signal > 0 ? 20 * Math.log10(signal / (noiseFloor + 1)) : 0;
      setSnr(Math.round(snrValue));

      const freqData = [];
      const step = Math.floor(bufferLength / 50);
      for (let i = 0; i < 50; i++) {
        const index = i * step;
        const freq = (index * nyquist) / bufferLength;
        freqData.push({
          freq: Math.round(freq),
          amplitude: dataArray[index]
        });
      }
      setFrequencyData(freqData);

      setSignalHistory(prev => {
        const newHistory = [...prev, { time: Date.now(), signal: normalizedDb, snr: snrValue }];
        return newHistory.slice(-50);
      });

      // Send data to remote peer
      sendSignalData({
        type: 'signal',
        isTransmitting: true,
        frequency: Math.round(dominantFreq),
        signalStrength: normalizedDb,
        frequencyData: freqData
      });

      animationFrameRef.current = requestAnimationFrame(analyze);
    };

    analyze();
  };

  const analyzeRemoteAudio = (stream) => {
    // Similar analysis for remote audio
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    const remoteAnalyser = audioContextRef.current.createAnalyser();
    remoteAnalyser.fftSize = 2048;
    const source = audioContextRef.current.createMediaStreamSource(stream);
    source.connect(remoteAnalyser);
  };

  const disconnect = () => {
    cleanup();
    setIsConnected(false);
    setMode('');
    setConnectionStatus('');
    setRemoteTransmitting(false);
    setRemoteFrequency(0);
    setRemoteSignalStrength(0);
  };

  const getSignalColor = (strength) => {
    if (strength > 70) return 'text-green-500';
    if (strength > 40) return 'text-yellow-500';
    return 'text-red-500';
  };

  if (!mode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6 flex items-center justify-center">
        <div className="max-w-2xl w-full">
          <div className="bg-slate-800 rounded-lg shadow-2xl p-8 border border-blue-500">
            <h1 className="text-3xl font-bold text-blue-400 mb-6 text-center flex items-center justify-center gap-3">
              <Activity className="w-8 h-8" />
              Radioaloqa Signal Analizatori
            </h1>
            
            <p className="text-slate-300 mb-8 text-center">
              Ikkita kompyuter o'rtasida audio aloqa va signal tahlili
            </p>

            <div className="space-y-4">
              <div className="bg-slate-700 p-6 rounded-lg border-l-4 border-green-500">
                <h3 className="text-xl font-bold text-green-400 mb-3 flex items-center gap-2">
                  <Server className="w-6 h-6" />
                  Server rejimi (1-kompyuter)
                </h3>
                <p className="text-slate-300 mb-4">
                  Bu kompyuterni server qiling. Boshqa kompyuter sizga ulanadi.
                </p>
                <button
                  onClick={startAsServer}
                  className="w-full bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition"
                >
                  Server sifatida boshlash
                </button>
              </div>

              <div className="bg-slate-700 p-6 rounded-lg border-l-4 border-blue-500">
                <h3 className="text-xl font-bold text-blue-400 mb-3 flex items-center gap-2">
                  <User className="w-6 h-6" />
                  Client rejimi (2-kompyuter)
                </h3>
                <p className="text-slate-300 mb-4">
                  Server kompyuterga ulanish uchun IP manzilini kiriting.
                </p>
                <input
                  type="text"
                  value={serverAddress}
                  onChange={(e) => setServerAddress(e.target.value)}
                  placeholder="Server IP (masalan: 192.168.1.5)"
                  className="w-full bg-slate-900 text-white p-3 rounded border border-blue-500 focus:outline-none focus:border-blue-400 mb-4"
                />
                <button
                  onClick={startAsClient}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition"
                >
                  Serverga ulanish
                </button>
              </div>
            </div>

            <div className="mt-6 bg-yellow-900/30 border border-yellow-600 rounded-lg p-4">
              <h4 className="text-yellow-400 font-semibold mb-2">📝 Yo'riqnoma:</h4>
              <ol className="text-slate-300 text-sm space-y-1 list-decimal list-inside">
                <li>Ikkala kompyuter bitta WiFi tarmog'ida bo'lishi kerak</li>
                <li>1-kompyuterni "Server" rejimida ishga tushiring</li>
                <li>Server IP manzilini ko'ring va eslab qoling</li>
                <li>2-kompyuterda server IP ni kiriting va ulaning</li>
                <li>Har ikki tarafda "Gapirish" tugmasini bosing</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-slate-800 rounded-lg shadow-2xl p-6 mb-6 border border-blue-500">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold text-blue-400 flex items-center gap-3">
              <Activity className="w-8 h-8" />
              {mode === 'server' ? 'Server Rejimi' : 'Client Rejimi'}
            </h1>
            <button
              onClick={disconnect}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold transition"
            >
              Chiqish
            </button>
          </div>
          
          <div className="bg-slate-700 p-4 rounded-lg mb-4">
            <div className="flex items-center gap-2">
              {isConnected ? <Wifi className="w-5 h-5 text-green-500" /> : <WifiOff className="w-5 h-5 text-red-500" />}
              <span className={isConnected ? 'text-green-400' : 'text-red-400'}>
                {connectionStatus}
              </span>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={startTransmission}
              disabled={!isConnected || isTransmitting}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition"
            >
              <Mic className="w-5 h-5" />
              Gapirish
            </button>
            
            <button
              onClick={stopTransmission}
              disabled={!isTransmitting}
              className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition"
            >
              <MicOff className="w-5 h-5" />
              To'xtatish
            </button>
          </div>
        </div>

        {isConnected && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-slate-800 p-6 rounded-lg border border-green-500">
                <h2 className="text-xl font-bold text-green-400 mb-4">📤 Sizning signalingiz</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-700 p-4 rounded-lg">
                    <div className="text-blue-300 text-sm mb-2">Chastota</div>
                    <div className="text-2xl font-bold text-white">{frequency} Hz</div>
                  </div>
                  <div className="bg-slate-700 p-4 rounded-lg">
                    <div className="text-green-300 text-sm mb-2">Signal</div>
                    <div className={`text-2xl font-bold ${getSignalColor(signalStrength)}`}>
                      {signalStrength.toFixed(1)} dB
                    </div>
                  </div>
                  <div className="bg-slate-700 p-4 rounded-lg">
                    <div className="text-yellow-300 text-sm mb-2">Shovqin</div>
                    <div className="text-2xl font-bold text-white">{noiseLevel}</div>
                  </div>
                  <div className="bg-slate-700 p-4 rounded-lg">
                    <div className="text-purple-300 text-sm mb-2">SNR</div>
                    <div className="text-2xl font-bold text-white">{snr} dB</div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800 p-6 rounded-lg border border-blue-500">
                <h2 className="text-xl font-bold text-blue-400 mb-4">📥 Qarshi tomondan</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-700 p-4 rounded-lg">
                    <div className="text-blue-300 text-sm mb-2">Chastota</div>
                    <div className="text-2xl font-bold text-white">{remoteFrequency} Hz</div>
                  </div>
                  <div className="bg-slate-700 p-4 rounded-lg">
                    <div className="text-green-300 text-sm mb-2">Signal</div>
                    <div className={`text-2xl font-bold ${getSignalColor(remoteSignalStrength)}`}>
                      {remoteSignalStrength.toFixed(1)} dB
                    </div>
                  </div>
                  <div className="col-span-2 bg-slate-700 p-4 rounded-lg text-center">
                    <div className="text-slate-300 text-sm mb-2">Holat</div>
                    <div className={`text-lg font-bold ${remoteTransmitting ? 'text-green-400' : 'text-slate-500'}`}>
                      {remoteTransmitting ? '🎤 Gapirmoqda' : '🔇 Tinch'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {isTransmitting && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-800 p-6 rounded-lg border border-blue-500">
                  <h2 className="text-xl font-bold text-blue-400 mb-4">Chastota Spektri</h2>
                  <BarChart width={500} height={300} data={frequencyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="freq" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #3b82f6' }} />
                    <Bar dataKey="amplitude" fill="#3b82f6" />
                  </BarChart>
                </div>

                <div className="bg-slate-800 p-6 rounded-lg border border-green-500">
                  <h2 className="text-xl font-bold text-green-400 mb-4">Signal Tarixi</h2>
                  <LineChart width={500} height={300} data={signalHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="time" stroke="#94a3b8" tickFormatter={(time) => new Date(time).toLocaleTimeString()} />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #10b981' }} />
                    <Legend />
                    <Line type="monotone" dataKey="signal" stroke="#10b981" name="Signal" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="snr" stroke="#8b5cf6" name="SNR" strokeWidth={2} dot={false} />
                  </LineChart>
                </div>
              </div>
            )}
          </>
        )}

        <audio ref={remoteAudioRef} autoPlay />
      </div>
    </div>
  );
};

export default RadioCommAnalyzer