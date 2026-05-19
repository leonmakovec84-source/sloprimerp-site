local ESX = exports["es_extended"]:getSharedObject()

local function notifyPlayer(src, message)
    TriggerClientEvent("chat:addMessage", src, {
        args = { "^3SLOPrimeRP", message }
    })
end

RegisterCommand("link", function(source, args)
    local src = tonumber(source) or 0
    if src <= 0 then
        return
    end

    local token = args[1]
    if not token or token == "" then
        notifyPlayer(src, "Uporabi: /link TOKEN")
        return
    end

    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then
        notifyPlayer(src, "Player ni bil najden.")
        return
    end

    local identifier = xPlayer.getIdentifier()
    if not identifier or identifier == "" then
        notifyPlayer(src, "Identifier ni bil najden.")
        return
    end

    local endpoint = string.format("%s%s", Config.ApiBaseUrl, Config.LinkEndpoint)
    local payload = json.encode({
        token = token,
        identifier = identifier
    })

    PerformHttpRequest(endpoint, function(statusCode, responseBody)
        if statusCode < 200 or statusCode >= 300 then
            notifyPlayer(src, "Povezava ni uspela. Preveri token ali web API.")
            return
        end

        local parsed = {}
        if responseBody and responseBody ~= "" then
            parsed = json.decode(responseBody) or {}
        end

        if parsed.success then
            notifyPlayer(src, "Account je bil uspesno povezan s spletno stranjo.")
        else
            notifyPlayer(src, "API ni vrnil uspesnega odgovora.")
        end
    end, "POST", payload, {
        ["Content-Type"] = "application/json"
    })
end, false)
