RegisterNetEvent("sloprime:voice")
AddEventHandler("sloprime:voice", function(text)
    SendNUIMessage({
        type = "speak",
        text = text
    })
end)