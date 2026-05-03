local active = false

RegisterNetEvent("garden:spawn")
AddEventHandler("garden:spawn", function()
    if active then
        return
    end

    local src = tonumber(source) or 0
    active = true
    local coords = Config.Locations[math.random(#Config.Locations)]
    local target = src > 0 and src or -1

    TriggerClientEvent("garden:start", target, coords)

    SetTimeout(300000, function()
        if active then
            TriggerClientEvent("garden:fail", target)
            active = false
        end
    end)
end)

RegisterNetEvent("garden:success")
AddEventHandler("garden:success", function()
    active = false
    TriggerEvent("sloprime:addXP", source, "vrtnar", 125)
end)
