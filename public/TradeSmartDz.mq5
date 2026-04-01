//+------------------------------------------------------------------+
//|                                              TradeSmartDz.mq5    |
//|                                         TradeSmartDz Journal EA  |
//+------------------------------------------------------------------+
#property copyright "TradeSmartDz"
#property version   "1.00"
#property strict

input string ApiUrl = "https://vikqwycjqqoobteslbxp.supabase.co";
input string ApiKey = "sb_publishable_5xxVaW03qs2Xj2kkfUhDVA_wcDDyQTZ";
input string UserId = ""; // User pastes their ID from TradeSmartDz website
input string AccountId = ""; // Account ID from TradeSmartDz website

datetime lastCheck = 0;

int OnInit()
{
   EventSetTimer(30); // Check every 30 seconds
   Print("TradeSmartDz EA started. User ID: ", UserId);
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   EventKillTimer();
}

void OnTimer()
{
   SyncClosedTrades();
}

void SyncClosedTrades()
{
   datetime fromTime = lastCheck == 0 ? TimeCurrent() - 86400 : lastCheck;

   HistorySelect(fromTime, TimeCurrent());

   int totalDeals = HistoryDealsTotal();

   for(int i = 0; i < totalDeals; i++)
   {
      ulong ticket = HistoryDealGetTicket(i);
      if(ticket == 0) continue;

      long entryType = HistoryDealGetInteger(ticket, DEAL_ENTRY);
      if(entryType != DEAL_ENTRY_OUT) continue; // Only closed trades

      string symbol = HistoryDealGetString(ticket, DEAL_SYMBOL);
      double profit = HistoryDealGetDouble(ticket, DEAL_PROFIT);
      double volume = HistoryDealGetDouble(ticket, DEAL_VOLUME);
      double price = HistoryDealGetDouble(ticket, DEAL_PRICE);
      datetime closeTime = (datetime)HistoryDealGetInteger(ticket, DEAL_TIME);
      long dealType = HistoryDealGetInteger(ticket, DEAL_TYPE);
      long positionId = HistoryDealGetInteger(ticket, DEAL_POSITION_ID);
      double commission = HistoryDealGetDouble(ticket, DEAL_COMMISSION);

      // Find the opening deal for this position
      double entryPrice = 0;
      datetime openTime = 0;
      string direction = dealType == DEAL_TYPE_BUY ? "SELL" : "BUY"; // Exit type is opposite

      for(int j = 0; j < totalDeals; j++)
      {
         ulong openTicket = HistoryDealGetTicket(j);
         if(openTicket == 0) continue;
         long openEntry = HistoryDealGetInteger(openTicket, DEAL_ENTRY);
         long openPosId = HistoryDealGetInteger(openTicket, DEAL_POSITION_ID);

         if(openEntry == DEAL_ENTRY_IN && openPosId == positionId)
         {
            entryPrice = HistoryDealGetDouble(openTicket, DEAL_PRICE);
            openTime = (datetime)HistoryDealGetInteger(openTicket, DEAL_TIME);
            long openType = HistoryDealGetInteger(openTicket, DEAL_TYPE);
            direction = openType == DEAL_TYPE_BUY ? "BUY" : "SELL";
            break;
         }
      }

      // Format times as ISO strings
      string openTimeStr = TimeToString(openTime, TIME_DATE|TIME_SECONDS);
      string closeTimeStr = TimeToString(closeTime, TIME_DATE|TIME_SECONDS);
      StringReplace(openTimeStr, ".", "-");
      StringReplace(closeTimeStr, ".", "-");
      StringReplace(openTimeStr, " ", "T");
      StringReplace(closeTimeStr, " ", "T");

      // Build JSON
      string json = StringFormat(
         "{\"user_id\":\"%s\",\"account_id\":\"%s\",\"ticket\":%I64d,\"symbol\":\"%s\","
         "\"direction\":\"%s\",\"entry\":%.5f,\"exit_price\":%.5f,\"volume\":%.2f,"
         "\"profit\":%.2f,\"commission\":%.2f,\"open_time\":\"%s\",\"close_time\":\"%s\","
         "\"setup_tag\":\"Other\"}",
         UserId, AccountId, positionId, symbol,
         direction, entryPrice, price, volume,
         profit, commission, openTimeStr, closeTimeStr
      );

      // Send to Supabase
      string headers = StringFormat(
         "Content-Type: application/json\r\napikey: %s\r\nAuthorization: Bearer %s\r\nPrefer: resolution=ignore-duplicates,return=minimal",
         ApiKey, ApiKey
      );

      string url = ApiUrl + "/rest/v1/trades";
      string response = "";
      char post[];
      char result[];
      string responseHeaders;

      StringToCharArray(json, post, 0, StringLen(json));

      int res = WebRequest("POST", url, headers, 5000, post, result, responseHeaders);

      if(res == 200 || res == 201)
      {
         Print("Trade synced: ", symbol, " ", direction, " profit: ", profit);
      }
      else
      {
         Print("Sync failed for ticket ", positionId, " HTTP: ", res);
      }
   }

   lastCheck = TimeCurrent();
}

void OnTick() {}
//+------------------------------------------------------------------+
