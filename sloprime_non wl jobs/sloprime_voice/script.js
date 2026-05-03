window.addEventListener("message", (event) => {
    if (event.data.type === "speak") {
        let msg = new SpeechSynthesisUtterance(event.data.text);
        msg.lang = "en-US";
        speechSynthesis.speak(msg);
    }
});