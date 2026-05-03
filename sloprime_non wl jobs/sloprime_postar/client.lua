local ESX = exports["es_extended"]:getSharedObject()
local working = false
local routeBlip = nil

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
    local model = GetHashKey(Config.NPC.model)
    RequestModel(model)
    while not HasModelLoaded(model) do Wait(0) end

    local npc = CreatePed(4, model,
        Config.NPC.coords.x,
        Config.NPC.coords.y,
        Config.NPC.coords.z - 1,
        Config.NPC.heading,
        false, true)

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
            ESX.ShowHelpNotification("Pritisni E za delo")

            if IsControlJustReleased(0, 38) then
                TriggerEvent("sloprime:voice", "Deliver the packages quickly.")
                TriggerServerEvent("post:spawn")
            end
        end
    end
end)

RegisterNetEvent("post:start")
AddEventHandler("post:start", function(coords)
    working = true

    createRouteBlip(coords)
    SetNewWaypoint(coords.x, coords.y)
    ESX.ShowNotification("Dostavi paket")

    CreateThread(function()
        while working do
            Wait(0)

            local pos = GetEntityCoords(PlayerPedId())

            if #(pos - coords) < 3.0 then
                working = false
                removeRouteBlip()
                ESX.ShowNotification("Dostavljeno")

                TriggerServerEvent("post:success")
            end
        end
    end)
end)

RegisterNetEvent("post:fail")
AddEventHandler("post:fail", function()
    if working then
        working = false
        removeRouteBlip()
        ESX.ShowNotification("Dostava je potekla")
    end
end)
