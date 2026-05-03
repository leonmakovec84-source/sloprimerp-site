local active = false

RegisterNetEvent("electric:spawn")
AddEventHandler("electric:spawn", function()
    if active then return end

    local src = tonumber(source) or 0
    active = true

    local coords = Config.Locations[math.random(#Config.Locations)]
    local target = src > 0 and src or -1

    TriggerClientEvent("electric:start", target, coords)

    SetTimeout(300000, function()
        if active then
            TriggerClientEvent("electric:fail", target)
            active = false
        end
    end)
end)

RegisterNetEvent("electric:success")
AddEventHandler("electric:success", function()
    active = false
    TriggerEvent("sloprime:addXP", source, "elektricar", 200)
end)
