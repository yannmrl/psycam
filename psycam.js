const https = require("https");
const fs = require("fs");
const WebSocket = require("ws");

const options =
{
    key: fs.readFileSync('/etc/letsencrypt/live/echo.wysigot.com/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/echo.wysigot.com/fullchain.pem')
};

const server = https.createServer(options, (req, res) =>
{
    res.writeHead(200);
    res.end("Serveur OK");

});

const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) =>
{
    console.log("Client connecté");

    ws.on("message", (message) =>
    {
        console.log("Reçu :", message.toString());

        const data = JSON.parse(message);

        if (data.type == "token")
        {
            ws.token = data.newtoken;
            console.log("h1");

            wss.clients.forEach(wsx =>
            {
                console.log("h2");
                if (
                    wsx.readyState === WebSocket.OPEN &&
                    wsx.token === ws.token &&
                    wsx.role === "display"
                )
                    wsx.send(JSON.stringify(
                    {
                        type: "register",
                        token: ws.token
                    }));
            });

            return;
        }

        if (data.type == "register")
        {
            ws.role = data.role;
            ws.token = data.token;

            console.log(`registered ${ws.role} ws (${ws.token})`);
        }

        sendToWS(ws.token, ws.role, JSON.stringify(data));

/*        wss.clients.forEach((client) =>
        {
            if (client !== ws && client.readyState === WebSocket.OPEN)
                client.send(message.toString());
        });*/

    });

    ws.on("close", () =>
    {
        console.log("Client déconnecté");
    });

});

function sendToWS(token, role, payload)
{
    // role inversion
    role = (role === "control") ? "display" : "control"
    wss.clients.forEach(client =>
    {
        if (client.readyState === WebSocket.OPEN && client.token === token && client.role === role)
            client.send(JSON.stringify(payload));
    });
}

server.listen(443, () =>
{
    console.log("HTTPS + WSS sur le port 443");
}); 