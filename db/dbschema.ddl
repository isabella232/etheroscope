create table contracts(
    contractHash VARCHAR(40)  not null,
    name         VARCHAR(128),
    abi          NVARCHAR(MAX),
    primary key (contractHash)
);

create table blocks(
    blockNumber BIGINT   not null,
    timeStamp   BIGINT   not null,
    userLog     BIT      not null,
    primary key (blockNumber)
);

create table variables(
    contractHash VARCHAR(40) not null,
    variableName VARCHAR(50) not null,
    cachedFrom   BIGINT,
    cachedUpTo   BIGINT,
    primary key (contractHash, variableName)
);

create table dataPoints(
    contractHash VARCHAR(40) not null,
    variableName VARCHAR(50) not null,
    blockNumber  BIGINT      not null,
    value        VARCHAR(78) not null,
    primary key (contractHash, variableName, blockNumber),
    foreign key (contractHash) references contracts(contractHash),
    foreign key (blockNumber) references  blocks(blockNumber),
    foreign key (contractHash, variableName) references  variables(contractHash, variableName)
);
