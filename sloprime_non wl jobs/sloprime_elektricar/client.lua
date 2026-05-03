local ESX = exports["es_extended"]:getSharedObject()
local working = false
local currentCoords = nil
local routeBlip = nil

local function loadModel(modelName)
    local model = GetHashKey(modelName)
    RequestModel(model)
    while not HasModelLoaded(model) do
        Wait(0)
    end
    return model
end

local function createStaticBlip()
    local blip = AddBlipForCoord(Config.NPC.coords.x, Config.NPC.coords.y, Config.NPC.coords.z)
    SetBlipSprite(blip, Config.Blip.sprite)
    SetBlipDisplay(blip, 4)
    SetBlipScale(blip, Config.Blip.scale)
    SetBlipColour(blip, Config.Blip.color)
    SetBlipAsShortRange(blip, true)
    BeginTextCommandSetBlipName("STRING")
    AddTextComponentString(Config.Blip.label)
    EndTextCommandSetBlipName(blip)
end

local function removeRouteBlip()
    if routeBlip and DoesBlipExist(routeBlip) then
        RemoveBlip(routeBlip)
        routeBlip = nil
    end
end

local function createRouteBlip(coords)
    removeRouteBlip()
    routeBlip = AddBlipForCoord(coords.x, coords.y, coords.z)
    SetBlipSprite(routeBlip, Config.RouteBlip.sprite)
    SetBlipDisplay(routeBlip, 4)
    SetBlipScale(routeBlip, Config.RouteBlip.scale)
    SetBlipColour(routeBlip, Config.RouteBlip.color)
    SetBlipRoute(routeBlip, true)
    SetBlipRouteColour(routeBlip, Config.RouteBlip.color)
    BeginTextCommandSetBlipName("STRING")
    AddTextComponentString(Config.RouteBlip.label)
    EndTextCommandSetBlipName(routeBlip)
end

CreateThread(function()
    local model = loadModel(Config.NPC.model)
    local npc = CreatePed(4, model, Config.NPC.coords.x, Config.NPC.coords.y, Config.NPC.coords.z - 1.0, Config.NPC.heading, false, true)

    FreezeEntityPosition(npc, true)
    SetEntityInvincible(npc, true)
    SetBlockingOfNonTemporaryEvents(npc, true)
    createStaticBlip()
end)

CreateThread(function()
    while true do
        Wait(0)

        local pos = GetEntityCoords(PlayerPedId())

        if #(pos - Config.NPC.coords) < 2.0 then
            ESX.ShowHelpNotification("Pritisni E za zacetek dela")

            if IsControlJustReleased(0, 38) and not working then
                TriggerEvent("sloprime:voice", "We have an electrical failure. Go fix it fast.")
                TriggerServerEvent("electric:spawn")
            end
        end
    end
end)

RegisterNetEvent("electric:start")
AddEventHandler("electric:start", function(coords)
    if not coords then
        return
    end

    working = true
    currentCoords = coords

    createRouteBlip(coords)
    SetNewWaypoint(coords.x, coords.y)
    ESX.ShowNotification("Pojdi do oznacene lokacije in odpravi okvaro")
end)

CreateThread(function()
    while true do
        Wait(0)

        if working and currentCoords then
            local pos = GetEntityCoords(PlayerPedId())
            local distance = #(pos - currentCoords)

            if distance < 20.0 then
                DrawMarker(
                    2,
                    currentCoords.x, currentCoords.y, currentCoords.z + 0.15,
                    0.0, 0.0, 0.0,
                    0.0, 0.0, 0.0,
                    0.35, 0.35, 0.35,
                    79, 243, 168, 180,
                    false, true, 2, false, nil, nil, false
                )
            end

            if distance < 2.2 then
                ESX.ShowHelpNotification("Pritisni E da popravis napako")

                if IsControlJustReleased(0, 38) then
                    working = false
                    currentCoords = nil
                    removeRouteBlip()
                    ESX.ShowNotification("Napaka odpravljena")
                    TriggerServerEvent("electric:success")
                end
            end
        end
    end
end)

RegisterNetEvent("electric:fail")
AddEventHandler("electric:fail", function()
    if working then
        working = false
        currentCoords = nil
        removeRouteBlip()
        ESX.ShowNotification("Elektricna naloga je potekla")
    end
end)
