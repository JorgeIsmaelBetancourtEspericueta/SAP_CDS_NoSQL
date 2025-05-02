namespace inv;

entity Simulation {
    key SIMULATION_ID      : String;
        STRATEGY_NAME        : String;
        DATE               : DateTime;
        SYMBOL             : String;
        ASSET_TYPE         : String;
        ASSET_NAME         : String;
        INITIAL_INVESTMENT : Decimal;
        PERIOD_DAYS        : Integer;
        START_DATE         : Date;
        END_DATE           : Date;
        RECOMMENDATION     : String;
        ENTRY_PRICE        : Decimal;
        EXIT_PRICE         : Decimal;
        PROFIT             : Decimal;
        RETURN_PERCENTAGE  : Decimal;
        SOLD               : Boolean;
        SELL_DATE          : Date;
        TREND              : String;
        VOLATILITY         : String;
        URL_DATA           : String;
        DETAIL_ROW         : array of {
            ACTIVED        : Boolean;
            DELETED        : Boolean;
            DETAIL_ROW_REG : array of {
                CURRENT : Boolean;
                REGDATE : DateTime;
                REGTIME : DateTime;
                REGUSER : String;
            }
        }
}


entity strategies {
    key ID          : Integer;
        NAME        : String;
        DESCRIPTION : String;
        TIME        : Time;
        RISK        : Double;
}
