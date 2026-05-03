local ESX = exports["es_extended"]:getSharedObject()

local function getLevel(xp)
    return math.floor(xp / Config.XPPerLevel) + 1
end

RegisterNetEvent("sloprime:addXP")
AddEventHandler("sloprime:addXP", function(job, amount)
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then
        return
    end

    local identifier = xPlayer.identifier

    MySQL.query('SELECT * FROM job_skills WHERE identifier = ? AND job = ?', {
        identifier, job
    }, function(result)

        if result[1] then
            local xp = result[1].xp + amount
            local level = getLevel(xp)

            MySQL.update('UPDATE job_skills SET xp = ?, level = ? WHERE identifier = ? AND job = ?', {
                xp, level, identifier, job
            })
        else
            MySQL.insert('INSERT INTO job_skills (identifier, job, xp, level) VALUES (?, ?, ?, ?)', {
                identifier, job, amount, 1
            })
        end
    end)
end)

-- workload (server sam generira jobe)
CreateThread(function()
    while true do
        Wait(120000)

        local r = math.random(1,4)

        if r == 1 then
            TriggerEvent("electric:spawn")
        elseif r == 2 then
            TriggerEvent("trash:spawn")
        elseif r == 3 then
            TriggerEvent("garden:spawn")
        elseif r == 4 then
            TriggerEvent("post:spawn")
        end
    end
end)
