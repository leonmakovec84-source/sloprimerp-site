local active = false

RegisterNetEvent("post:spawn")
AddEventHandler("post:spawn", function()
    if active then
        return
    end

    local src = tonumber(source) or 0
    active = true
    local coords = Config.Locations[math.random(#Config.Locations)]
    local target = src > 0 and src or -1

    TriggerClientEvent("post:start", target, coords)

    SetTimeout(300000, function()
        if active then
            TriggerClientEvent("post:fail", target)
            active = false
        end
    end)
end)

RegisterNetEvent("post:success")
AddEventHandler("post:success", function()
    active = false
    TriggerEvent("sloprime:addXP", source, "postar", 100)
end)
