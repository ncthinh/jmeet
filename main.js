console.log("update7");
const firestore = firebase.firestore();

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
      
    },

    {
      urls: "turn:numb.viagenie.ca",
      username: "webrtc@live.com",
      credential: "muazkh"
    },
  ],
  iceCandidatePoolSize: 10,
};

// Global State
const pc = new RTCPeerConnection(servers);
const dc = pc.createDataChannel("sendMessages",{negotiated: true, id: 0});
let localStream = null;
let remoteStream = null;
let roomID = null;
// HTML elements 

document.getElementById("step3").style.display = "none";

const webcamButton = document.getElementById('webcamButton');
const readyButton = document.getElementById('readyButton');

const webcamVideo = document.getElementById('webcamVideo');
const remoteVideo = document.getElementById('remoteVideo');
const webcamVideoat = document.getElementById('webcamVideoat');
const roomInput = document.getElementById('roomInput');
const createBtn = document.getElementById('createBtn');

const answerButton = document.getElementById('answerButton');
const callInput = document.getElementById('callInput');
const hangupButton = document.getElementById('hangupButton');

// 1. Setup media sources
const mediaConfig = { video: true, audio: true};
webcamButton.onclick = async () => {
  localStream = await navigator.mediaDevices.getUserMedia(mediaConfig);
  remoteStream = new MediaStream();
  
  // Push tracks from local stream to peer connection
  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  // Pull tracks from remote stream, add to video stream
  pc.ontrack = (event) => { 				  //event = RTCTrackEvent; 
    event.streams[0].getTracks().forEach((track) => {   //streams:An Array of MediaStream objects, 
      remoteStream.addTrack(track);			  //one for each stream that make up the new track.
    });
  };

  webcamVideo.srcObject = localStream;
  webcamVideoat.srcObject = localStream;
  remoteVideo.srcObject = remoteStream;   
};

//readyButton.onclick = () => {
//  document.getElementById("step1").style.display = "none";
  //document.getElementById("step2").style.display = "block";
//};

// 2. Create an offer when click create room
createBtn.onclick = async () => {
  // Reference Firestore collections for signaling  
  const ID = roomInput.value;
  if (ID == '') {
    alert('Room name is empty!');
  } else {        
    roomID = ID;
    console.log('RoomID:', roomID);
    alert('Room ' + roomID + ' has been created');
    const callDoc = firestore.collection('calls').doc(roomID);
    const offerCandidates = callDoc.collection('offerCandidates');
    const answerCandidates = callDoc.collection('answerCandidates');
    // Get candidates for caller
    pc.onicecandidate = (event) => {
      event.candidate && offerCandidates.add(event.candidate.toJSON());
      console.log('Got candidate: ', event.candidate);
    };
    // Create offer
    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);
    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };
    //Store info into db    
    await callDoc.set({ offer });
    // Listen for remote answer
    callDoc.onSnapshot((snapshot) => {
      const data = snapshot.data();
      if (!pc.currentRemoteDescription && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer);
        pc.setRemoteDescription(answerDescription);
      }
    });
    // When answered, add candidate to local peer connection
    answerCandidates.onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const candidate = new RTCIceCandidate(change.doc.data());
          pc.addIceCandidate(candidate);
          document.getElementById("sendBtn").disabled=false;
        }
      });
    });
    document.getElementById("step1").style.display = "none";
    document.getElementById("step2").style.display = "none";
    document.getElementById("step3").style.display = "flex";
    
  }
};

// 3. Answer the call with the unique ID

answerButton.onclick = async () => {
  document.getElementById("step1").style.display = "none";
  document.getElementById("step2").style.display = "none";
  document.getElementById("step3").style.display = "flex";
  //webcamVideoat.srcObject = localStream;
  const callId = callInput.value;
  const callDoc = firestore.collection('calls').doc(callId);
  const answerCandidates = callDoc.collection('answerCandidates');
  const offerCandidates = callDoc.collection('offerCandidates');

  pc.onicecandidate = (event) => {
    event.candidate && answerCandidates.add(event.candidate.toJSON());
    console.log('Got candidate: ', event.candidate);
  };

  const callData = (await callDoc.get()).data();

  const offerDescription = callData.offer;
  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
  };

  await callDoc.update({ answer });

  offerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      console.log(change);
      if (change.type === 'added') {
        let data = change.doc.data();
        pc.addIceCandidate(new RTCIceCandidate(data));
        document.getElementById("sendBtn").disabled=false;
      }
    });
  });  
};
// --------//
//const messageBox = document.getElementById('messageBox');  
//const sendButton = document.getElementById('sendButton');     
//const incomingMessages = document.getElementById('incomingMessages');  

//dc.onerror = (error) => {
//  console.log("Data Channel Error:", error);
//};

dc.onmessage = (event) => {
  console.log("Got Data Channel Message:", event.data);
  var item = document.createElement('li');
  item.className="rxMsg";
  item.textContent = event.data;
  messages.appendChild(item);
  //window.scrollTo(0, document.body.scrollHeight);
//const message = event.data;
//incomingMessages.value += message + '\n';
};

dc.onopen = () => {
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    if (input.value) {  
      var item = document.createElement('li');
      item.className="txMsg";
      item.textContent = input.value;
      messages.appendChild(item);
      //window.scrollTo(0, document.body.scrollHeight);
      dc.send(input.value);   
        // socket.emit('chat message', input.value);
      input.value = '';
//sendButton.onclick = () => {    
//    let msg = messageBox.value;
//    dc.send(msg);
//    msg = '';
    };
  });
};
dc.onclose = () => {
  console.log("The Data Channel is Closed");
};

var messages = document.getElementById('messages');
var form = document.getElementById('form');
var input = document.getElementById('input');

