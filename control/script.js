const socket = new WebSocket("wss://echo.wysigot.com:443");

let token = "";
if (window.location.href.includes("token="))
{
    token = window.location.href.split("token=")[1].split('&')[0].split('?')[0];
    document.getElementById("tokeninput").value = token;
}

socket.onopen = () =>
{
    console.log("connected to web socket server");
    socket.send(JSON.stringify(
    {
        type: "register",
        role: "control",
        token: token
    }));
};

socket.onmessage = async (event) =>
{
    const ic = JSON.parse(JSON.parse(event.data));

    console.log("Incoming socket message");
    console.log(ic);

    if (ic.token != token)
    {
        console.log("wrong token");
        return;
    }

    switch (ic.type)
    {
        case "state":
            const effects_ = JSON.parse(ic.effects);

            const colorCode = ic.color;

            colorPicker.color.set(colorCode);

            enabled.clear();
            effects_.forEach(eff => enabled.add(eff));

            document.querySelectorAll("button").forEach(button =>
            {
                button.classList.toggle(
                    "active",
                    enabled.has(button.textContent)
                );
            });

            document.getElementById("tokeninput").style.color = "orange";
            break;
        
        case "answer":
            await pc.setRemoteDescription(ic.answer);            
            break;
        
        case "ice":
            await pc.addIceCandidate(ic.candidate);
            break;
    }
};

socket.onerror = (error) =>
{
    console.error("websocket error :", error);
};


socket.onclose = () =>
{
    console.log("disconnected from web socket server");
};

let pc = null;
let onair = false;

let cameraMode = "user";
let localStream = null

const video = document.getElementById("preview");

const effects =
{
    "Color":
    [
        "invert",
        "thermal",
        "nightvision",
        "grayscale",
        "posterize",
        "acid",
        "rainbowpulse",
        "colorful"
    ],

    "Signal":
    [
        "raw",
        "raw2",
        "motionblur",
        "rgbshift",
        "glitch",
        "glitch2",
        "edge"
    ],

    "Corruption":
    [
        "fragment",
        "fragment2",
        "pixeldissolve",
        "crtcollapse"
    ],

    "Distorsion":
    [
        "spiral",
        "liquid",
        "liquidborder",
        "bounce",
        "fovmax",
/*        "wallblend",*/
        "neonhalo"
    ],

    "Recursion":
    [
        "feedback",
        "fractal",
        "kaleidoscope"
    ],

    "Abstraction":
    [
        "ascii",
        "pixelated",
        "constellation"
    ],

    "Audio":
    [
        "strobe",
        "strobex2",
        "beatshake",
        "beatsolar",
        "kickzoom",
        "crush",
        "vortex"
    ]
};

const effectGradients =
{
    invert:         "linear-gradient(135deg,#ff6b6b,#584DA8)",
    thermal:        "linear-gradient(135deg,#ff0000,#ffff00)",
    nightvision:    "linear-gradient(135deg,#003300,#00ff66)",
    grayscale:      "linear-gradient(135deg,#111,#999)",
    posterize:      "linear-gradient(135deg,#ff0080,#8000ff)",
    acid:           "linear-gradient(168deg,#C900AD,#002CBD,#F2FF00)",

    rainbowpulse:   "linear-gradient(135deg,#ff0000,#F200FF,#0000ff)",
    colorful:       "linear-gradient(135deg,#FFE300,#00ffe5)",

    raw:            "linear-gradient(180deg,#FE9000,#6C0000,#000000)",
    raw2:           "linear-gradient(0deg,#FE1000,#6C1000,#000000,#FF6200)",

    motionblur:     "linear-gradient(135deg,#74c0fc,#1864ab)",
    rgbshift:       "linear-gradient(135deg,#ff0000,#0000ff)",
    glitch:         "linear-gradient(135deg,#000000,#FF00FF,#000000)",//,#FF00FF,#000000,#FF00FF,#000000,#FF00FF,#000000,#FF00FF,#000000,#FF00FF)",
    glitch2:        "linear-gradient(225deg,#C4C4C4,#A300A3,#C4C4C4)",//,#A300A3,#C4C4C4,#A300A3,#C4C4C4,#A300A3,#C4C4C4,#A300A3,#C4C4C4,#A300A3)",
    edge:           "linear-gradient(135deg,white,black,white)",

    fragment:       "linear-gradient(90deg,#00E1FF,#ff5e62,#00E1FF)",
    fragment2:      "linear-gradient(90deg,#8e2de2,#4a00e0,#8e2de2)",
    pixeldissolve:  "linear-gradient(135deg,#00c6ff,#0072ff)",
    crtcollapse:    "linear-gradient(135deg,#00ff00,#003300)",

    spiral:         "linear-gradient(135deg,#ff6ec4,#7873f5)",
    liquid:         "linear-gradient(135deg,#00f2fe,#4facfe)",
    liquidborder:   "linear-gradient(135deg,#30cfd0,#330867)",
    bounce:         "linear-gradient(135deg,#f7971e,#ffd200)",
    fovmax:         "linear-gradient(135deg,#00dbde,#fc00ff)",
    wallblend:      "linear-gradient(135deg,#3a1c71,#d76d77,#ffaf7b)",
    neonhalo:       "linear-gradient(135deg,#00ffff,#ff00ff)",

    feedback:       "linear-gradient(135deg,#fc466b,#3f5efb)",
    fractal:        "linear-gradient(135deg,#7f00ff,#e100ff)",
    kaleidoscope:   "linear-gradient(135deg,#f857a6,#ff5858)",

    ascii:          "linear-gradient(135deg,#111,#00ff00)",
    pixelated:      "linear-gradient(135deg,#ff512f,#dd2476)",
    constellation:  "linear-gradient(135deg,#0f2027,#203a43,#2c5364)",

    strobe:         "linear-gradient(135deg,#ffffff,#000000)",
    strobex2:       "linear-gradient(135deg,#ffff00,#ff0000)",
    
    beatshake:      "linear-gradient(90deg,#ff0000,#000000,#ff0000)",
    beatsolar:      "linear-gradient(135deg,#ffe600,#ff6600,#4400ff)",
    kickzoom:       "linear-gradient(270deg,#ffffff,#ff0080,#3a00ff)",
    crush:          "linear-gradient(135deg,#00e5ff,#0066ff)",
    vortex:         "linear-gradient(135deg,#ff00ff,#4400ff,#00ffff)",
};

const enabled = new Set();

Object.entries(effects).forEach(([familyName, effectFamily], i)=>
{
    document.getElementById("p1").appendChild(//insertBefore(
        Object.assign(
            document.createElement("div"),
            { id: `effects${i}` },
            { className: "ediv" }
        ),
        document.querySelector(".clast")
    );

    document.getElementById(`effects${i}`).appendChild(
        Object.assign(
            document.createElement("label"),
            { innerHTML: familyName }
        )
    );
    
    effectFamily.forEach(effect=>
    {
        const button = document.createElement("button");

        button.textContent = effect;
        //button.style.background = effectGradients[effect];

        button.addEventListener(
            "click",
            ()=>
            {
                if(enabled.has(effect))
                {
                    enabled.delete(effect);

                    button.classList.remove("active");

                    socket.send(JSON.stringify(
                    {
                        type: "disable",
                        role: "control",
                        token: token,
                        effect: effect
                    }));
                }
                else
                {
                    enabled.add(effect);

                    button.classList.add("active");

                    socket.send(JSON.stringify(
                    {
                       type: "enable",
                       role: "control",
                       token: token,
                       effect: effect
                    }));
                }
            }
        );

        document.getElementById(`effects${i}`).appendChild(button);
    });    
});

document.getElementById("flipX").addEventListener("click", () =>
{
    socket.send(JSON.stringify(
    {
        type: "flipX",
        role: "control",
        token: token
    }));
    document.getElementById("preview").classList.toggle("flipX");
});

document.getElementById("flipY").addEventListener("click", () =>
{
    socket.send(JSON.stringify(
    {
        type: "flipY",
        role: "control",
        token: token
    }));
    document.getElementById("preview").classList.toggle("flipY");
});

document.getElementById("auto").addEventListener("click", () =>
{
    socket.send(JSON.stringify(
    {
        type: "switchmode",
        role: "control",
        token: token
    }));
    document.getElementById("auto").innerHTML = document.getElementById("auto").innerHTML === "AUTO" ? "MANUAL" : "AUTO";
});

document.getElementById("clear").addEventListener("click", () =>
{
    socket.send(JSON.stringify(
    {
        type: "clear",
        role: "control",
        token: token
    }));
});

/*document.getElementById("cover").addEventListener("click", () =>
{
    document.getElementById("preview").classList.toggle("preview_169");

    socket.send(JSON.stringify(
    {
        type: "cover",
        role: "control",
        token: token
    }));
});*/

const colorPicker = new iro.ColorPicker("#picker",
{
    width: 100,
    color: "#ffffff",
    borderWidth: 1,
    borderColor: "#fff",
    layout:
    [
        {
            component: iro.ui.Wheel,
            options: {}
        },
        {
            component: iro.ui.Slider,
            options:
            {
                sliderType: 'saturation'
            }
        }
    ]
});

const colorValueDisplay = document.getElementById("color-value");

colorPicker.on("color:change", function(color)
{
    colorValueDisplay.textContent = color.hexString;
      
    document.getElementsByClassName('ediv-color')[0].style.background = color.hexString;

    socket.send(JSON.stringify(
    {
        type: "color",
        role: "control",
        token: token,
        value: color.hexString
    }));
});

function updatetoken(el)
{
    el.color = "";
    socket.send(JSON.stringify(
    {
        type: "token",
        role: "control",
        token: token,
        newtoken: el.value
    }));

    token = el.value;
}

async function switchCamera()
{
    const oldStream = localStream;

    cameraMode =
        cameraMode === "user"
            ? "environment"
            : "user";

    const newStream =
        await navigator.mediaDevices.getUserMedia(
        {
            video:
            {
                facingMode: cameraMode,

                width: { ideal: 640 },
                height: { ideal: 360 },

                frameRate:
                {
                    ideal: 30,
                    max: 30
                }
            },
            audio: false
        });

    const newTrack =
        newStream.getVideoTracks()[0];

    if(pc)
    {
        const sender =
            pc.getSenders().find(sender =>
                sender.track &&
                sender.track.kind === "video"
            );

        if(sender)
        {
            await sender.replaceTrack(newTrack);
        }
    }

    localStream = newStream;
    video.srcObject = newStream;

    if(oldStream)
    {
        oldStream.getTracks().forEach(track =>
            track.stop()
        );
    }

    socket.send(JSON.stringify(
    {
        type: "flipX",
        role: "control",
        token: token
    }));

    document.getElementById("preview").classList.toggle("flipX");
}

async function golive()
{
    const video = document.getElementById("preview");

    if (video.srcObject)
    {
        document.getElementById("golive").innerHTML =
            onair
            ? "Go Live 🔴"
            : "On Air 🟥";

        socket.send(JSON.stringify(
        {
            type: "source",
            role: "control",
            token: token,
            source: onair ? "local" : "remote"
        }));

        onair = !onair;

        document.getElementById("livecontrols").style.display =
            onair ? "grid" : "none";

        return;
    }

    console.log("going live");

    cameraMode = "user";

    localStream =
        await navigator.mediaDevices.getUserMedia(
        {
            video:
            {
                facingMode: "user",

                width: { ideal: 640 },
                height: { ideal: 360 },

                frameRate:
                {
                    ideal: 30,
                    max: 30
                }
            },
            audio: false
        });

    video.srcObject = localStream;

    pc = new RTCPeerConnection(
    {
        iceServers:
        [
            {
                urls: "stun:stun.l.google.com:19302"
            }
        ]
    });

    pc.onicecandidate = (event) =>
    {
        if (event.candidate)
        {
            socket.send(JSON.stringify(
            {
                type: "ice",
                token: token,
                role: "control",
                candidate: event.candidate
            }));
        }
    };

    pc.onconnectionstatechange = () =>
    {
        console.log(
            "DV2:",
            pc.connectionState
        );
    };

    localStream.getTracks().forEach(track =>
    {
        pc.addTrack(track, localStream);
    });

    const offer = await pc.createOffer();

    await pc.setLocalDescription(offer);

    socket.send(JSON.stringify(
    {
        type: "offer",
        token: token,
        role: "control",
        offer: pc.localDescription
    }));

    document.getElementById("golive").innerHTML =
        "On Air 🟥";

    onair = true;

    document.getElementById("livecontrols").style.display =
        "grid";
}

let bpm = 120;
let beatPhase = 0;

const taps = [];

let lastTapTime = performance.now();

function tapTempo() {
    const now = performance.now();

    // Si on n'a pas tapé depuis 2 secondes,
    // on repart de zéro
    if (now - lastTapTime > 2000) {
        taps.length = 0;
    }

    taps.push(now);
    lastTapTime = now;

    // On garde les 8 derniers taps
    while (taps.length > 8) {
        taps.shift();
    }

    // Calcul BPM moyen
    if (taps.length >= 2) {
        let totalInterval = 0;

        for (let i = 1; i < taps.length; i++) {
            totalInterval += taps[i] - taps[i - 1];
        }

        const averageInterval =
            totalInterval / (taps.length - 1);

        bpm = 60000 / averageInterval;
    }

    socket.send(JSON.stringify(
    {
        type: "tempo",
        role: "control",
        token: token,
        bpm: bpm,
        lastTapTime: lastTapTime
    }));
}

function updateBeatPhase() {
    const now = performance.now();

    const beatDuration = 60000 / bpm;

    beatPhase =
        ((now - lastTapTime) % beatDuration) /
        beatDuration;

    requestAnimationFrame(updateBeatPhase);

    document.getElementById("tap-button").innerHTML = `${parseInt(bpm)} BPM`;
    //document.getElementById("phase").innerHTML = `Beat Phase: ${beatPhase.toFixed(3)}`;
}

updateBeatPhase();

/*async function switchCamera()
{
    cameraMode =
        cameraMode === "user"
            ? "environment"
            : "user";

    if(localStream)
    {
        localStream.getTracks().forEach(track =>
            track.stop()
        );
    }

    const newStream =
        await navigator.mediaDevices.getUserMedia(
        {
            video:
            {
                facingMode: cameraMode
            },
            audio: false
        });

    const newTrack =
        newStream.getVideoTracks()[0];

    if(pc)
    {
        const sender =
            pc.getSenders().find(sender =>
                sender.track?.kind === "video");

        if(sender)
            await sender.replaceTrack(newTrack);
    }

    localStream = newStream;

    video.srcObject = localStream;
}

async function golive()
{
    const video = document.getElementById("preview");

    if (video.srcObject)
    {
        document.getElementById("golive").innerHTML = onair ? "Go Live 🔴" : "On Air 🟥";
        socket.send(JSON.stringify(
        {
            type: "source",
            role: "control",
            token: token,
            source: onair ? "local" : "remote"
        }));

        onair = !onair;

        document.getElementById("livecontrols").style.display = onair ? "grid" : "none";

        return;
    }
    console.log("going live");


    const stream = await navigator.mediaDevices.getUserMedia(
    {
        video: true,
        audio: false
    });

    video.srcObject = stream;

    pc = new RTCPeerConnection({iceServers: [{urls: "stun:stun.l.google.com:19302"}]});

    pc.onicecandidate = (event) =>
    {
        if (event.candidate)
        {
            socket.send(JSON.stringify(
            {
                type: "ice",
                token: token,
                role: "control",
                candidate: event.candidate
            }));
        }
    };

    pc.onconnectionstatechange = () =>
    {
        console.log("DV2 :", pc.connectionState);
    };

    stream.getTracks().forEach(track =>
    {
        pc.addTrack(track, stream);
    });

    const offer = await pc.createOffer();

    await pc.setLocalDescription(offer);

    socket.send(JSON.stringify(
    {
        type: "offer",
        token: token,
        role: "control",
        offer: pc.localDescription
    }));

    document.getElementById("golive").innerHTML = "On Air 🟥";
    onair = true;
    document.getElementById("livecontrols").style.display = "grid";
}*/