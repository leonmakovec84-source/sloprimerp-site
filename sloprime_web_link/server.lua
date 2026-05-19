local ESX = exports["es_extended"]:getSharedObject()

local function notifyPlayer(src, message)
    local xPlayer = ESX.GetPlayerFromId(src)
    if xPlayer and xPlayer.showNotification then
        xPlayer.showNotification(message)
        return
    end

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

    local identifier = xPlayer.identifier or (xPlayer.getIdentifier and xPlayer.getIdentifier()) or ""
    if not identifier or identifier == "" then
        notifyPlayer(src, "Identifier ni bil najden.")
        return
    end

    local baseUrl = tostring(Config.ApiBaseUrl or ""):gsub("/+$", "")
    local linkEndpoint = tostring(Config.LinkEndpoint or "")
    if linkEndpoint == "" then
        linkEndpoint = "/api/game/link"
    end

    if linkEndpoint:sub(1, 1) ~= "/" then
        linkEndpoint = "/" .. linkEndpoint
    end

    local endpoint = string.format("%s%s", baseUrl, linkEndpoint)
    local payload = json.encode({
        token = token,
        identifier = identifier
    })

    print(("[SLOPrimeRP Web Link] Linking %s with token %s"):format(identifier, token))

    PerformHttpRequest(endpoint, function(statusCode, responseBody)
        if statusCode < 200 or statusCode >= 300 then
            print(("[SLOPrimeRP Web Link] API failed with status %s and body %s"):format(statusCode, responseBody or ""))
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
            print(("[SLOPrimeRP Web Link] API returned unexpected body %s"):format(responseBody or ""))
            notifyPlayer(src, "API ni vrnil uspesnega odgovora.")
        end
    end, "POST", payload, {
        ["Content-Type"] = "application/json"
    })
end, false)
