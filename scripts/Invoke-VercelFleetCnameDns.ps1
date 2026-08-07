[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^[a-zA-Z0-9.-]+$')]
    [string]$Target,

    [ValidateRange(600, 86400)]
    [int]$Ttl = 600,

    [switch]$Apply
)

$ErrorActionPreference = 'Stop'
$domainName = 'alphaqwq.xyz'
$recordName = 'fleet'
$recordType = 'CNAME'
$recordLine = 'default'
$normalizedTarget = $Target.TrimEnd('.').ToLowerInvariant()

function Invoke-AliDns {
    param([string[]]$Arguments)

    # aliyun CLI 3.4.x no longer accepts --output json (that flag is for cols= table output only);
    # default output format is json (aliyun configure reports "Only support json").
    $output = & aliyun @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "aliyun command failed with exit code $LASTEXITCODE."
    }

    return $output | ConvertFrom-Json
}

if (-not (Get-Command aliyun -ErrorAction SilentlyContinue)) {
    throw 'aliyun CLI was not found. Install and configure it locally before running this script.'
}

$recordsResponse = Invoke-AliDns @(
    'alidns',
    'DescribeDomainRecords',
    '--DomainName', $domainName,
    '--RRKeyWord', $recordName
)
$records = @($recordsResponse.DomainRecords.Record)
$matchingRecords = @($records | Where-Object { $_.RR -eq $recordName })
$nonCnameRecords = @($matchingRecords | Where-Object { $_.Type -ne $recordType })
$cnameRecords = @($matchingRecords | Where-Object { $_.Type -eq $recordType })
$defaultLineCnameRecords = @($cnameRecords | Where-Object { $_.Line -eq $recordLine })
$nonDefaultLineCnameRecords = @($cnameRecords | Where-Object { $_.Line -ne $recordLine })

if ($nonCnameRecords.Count -gt 0 -or $nonDefaultLineCnameRecords.Count -gt 0 -or $defaultLineCnameRecords.Count -gt 1) {
    throw 'Conflicting fleet records were found. No DNS change was made.'
}

if ($defaultLineCnameRecords.Count -eq 0) {
    $action = 'Add'
    $currentRecord = $null
} else {
    $currentRecord = $defaultLineCnameRecords[0]
    $currentValue = $currentRecord.Value.TrimEnd('.').ToLowerInvariant()
    if ($currentValue -eq $normalizedTarget -and [int]$currentRecord.TTL -eq $Ttl) {
        [pscustomobject]@{
            Action = 'None'
            DomainName = $domainName
            RR = $recordName
            Type = $recordType
            Value = $normalizedTarget
            TTL = $Ttl
            RecordId = $currentRecord.RecordId
        } | Format-List
        exit 0
    }

    $action = 'Update'
}

[pscustomobject]@{
    Action = $action
    DomainName = $domainName
    RR = $recordName
    Type = $recordType
    Value = $normalizedTarget
    TTL = $Ttl
    RecordId = if ($null -eq $currentRecord) { $null } else { $currentRecord.RecordId }
    Apply = $Apply.IsPresent
} | Format-List

if (-not $Apply) {
    exit 2
}

if ($action -eq 'Add') {
    Invoke-AliDns @(
        'alidns',
        'AddDomainRecord',
        '--DomainName', $domainName,
        '--RR', $recordName,
        '--Type', $recordType,
        '--Value', $normalizedTarget,
        '--TTL', $Ttl,
        '--Line', $recordLine
    ) | Out-Null
} else {
    Invoke-AliDns @(
        'alidns',
        'UpdateDomainRecord',
        '--RecordId', $currentRecord.RecordId,
        '--RR', $recordName,
        '--Type', $recordType,
        '--Value', $normalizedTarget,
        '--TTL', $Ttl,
        '--Line', $recordLine
    ) | Out-Null
}

$verificationResponse = Invoke-AliDns @(
    'alidns',
    'DescribeDomainRecords',
    '--DomainName', $domainName,
    '--RRKeyWord', $recordName,
    '--TypeKeyWord', $recordType
)
$verificationRecords = @($verificationResponse.DomainRecords.Record | Where-Object {
    $_.RR -eq $recordName -and $_.Type -eq $recordType -and $_.Line -eq $recordLine
})

if ($verificationRecords.Count -ne 1) {
    throw 'Alidns post-write verification did not return exactly one target CNAME record.'
}

$verificationValue = $verificationRecords[0].Value.TrimEnd('.').ToLowerInvariant()
if ($verificationValue -ne $normalizedTarget -or [int]$verificationRecords[0].TTL -ne $Ttl) {
    throw 'Alidns post-write verification did not match the requested CNAME value and TTL.'
}

$dnsResult = Resolve-DnsName "$recordName.$domainName" -Type CNAME -ErrorAction Stop
$resolvedTargets = @($dnsResult | Where-Object { $_.Type -eq 'CNAME' } | ForEach-Object { $_.NameHost.TrimEnd('.').ToLowerInvariant() })
if ($resolvedTargets -notcontains $normalizedTarget) {
    throw 'Public DNS did not yet return the requested CNAME value. No additional DNS write was attempted.'
}

[pscustomobject]@{
    Action = $action
    DomainName = $domainName
    RR = $recordName
    Type = $recordType
    Value = $normalizedTarget
    TTL = $Ttl
    RecordId = $verificationRecords[0].RecordId
    AlidnsVerified = $true
    PublicDnsVerified = $true
} | Format-List
