namespace inv;


type DetailRowReg : {
    CURRENT : Boolean;
    REGDATE : DateTime;
    REGTIME : DateTime; 
    REGUSER : String;
};

type DetailRow : {
    ACTIVED        : Boolean;
    DELETED        : Boolean;
    DETAIL_ROW_REG : array of DetailRowReg;
};

type StrategyRule : {
    INDICATOR : String;
    PERIOD    : Integer;
    CONDITION : String;
    ACTION    : String;
};

// Entidades
entity Simulation {
    key idSimulation       : String;
        idUser             : String;
        idStrategy         : String;
        simulationName     : String;
        symbol             : String;
        startDate          : Date;
        endDate            : Date;
        amount             : Decimal(10,2);
        specs              : String;
        result             : Decimal(10,2);
        percentageReturn   : Decimal(5,2);
        signals            : array of Signal;
        DETAIL_ROW         : array of DetailRow;
}

type Signal {
    date        : DateTime;
    type        : String;
    price       : Decimal(10,2);
    reasoning   : String;
}

entity strategies {
    key ID          : String;
        NAME        : String;
        DESCRIPTION : String;
        RULES       : array of StrategyRule;
        DETAIL_ROW  : array of DetailRow;
}
