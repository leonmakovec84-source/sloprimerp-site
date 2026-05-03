local active = false

RegisterNetEvent("trash:spawn")
AddEventHandler("trash:spawn", function()
    if active then
        return
    end

    local src = tonumber(source) or 0
    active = true
    local coords = Config.Locations[math.random(#Config.Locations)]
    local target = src > 0 and src or -1

    TriggerClientEvent("trash:start", target, coords)

    SetTimeout(300000, function()
        if active then
            TriggerClientEvent("trash:fail", target)
            active = false
        end
    end)
end)

RegisterNetEvent("trash:success")
AddEventHandler("trash:success", function()
    active = false
    TriggerEvent("sloprime:addXP", source, "smetar", 125)
end)
