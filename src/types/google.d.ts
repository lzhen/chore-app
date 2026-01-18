// Google API type declarations

declare namespace gapi {
  function load(api: string, callback: () => void): void;

  namespace client {
    function init(config: { discoveryDocs?: string[] }): Promise<void>;
    function getToken(): { access_token: string } | null;
    function setToken(token: null): void;

    namespace calendar {
      namespace events {
        function insert(params: {
          calendarId: string;
          resource: {
            summary: string;
            description?: string;
            start: { date?: string; dateTime?: string };
            end: { date?: string; dateTime?: string };
            colorId?: string;
          };
        }): Promise<{ result: { id?: string } }>;

        function remove(params: {
          calendarId: string;
          eventId: string;
        }): Promise<void>;
      }
    }
  }
}

declare namespace google {
  namespace accounts {
    namespace oauth2 {
      interface TokenClient {
        callback: (response: { error?: string }) => void;
        requestAccessToken(config: { prompt: string }): void;
      }

      function initTokenClient(config: {
        client_id: string;
        scope: string;
        callback: () => void;
      }): TokenClient;

      function revoke(token: string, callback: () => void): void;
    }
  }
}
