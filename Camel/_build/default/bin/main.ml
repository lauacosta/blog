module Scanner = struct 
  let scan_tokens line =
    String.split_on_char ' ' line
end

module Token = struct
  type t = string
  let print (t : t) = print_string ("+" ^ t ^ "+")
end

let run_file file =
  print_endline file

let run line =
  let tokens = Scanner.scan_tokens line in
  List.iter Token.print tokens

let run_repl =
  while true do
    print_string ">> ";
    let line = read_line () in
    run line;
    print_endline "";
  done


let () =
  let args = Sys.argv  in
  match Array.length args with
  len when len > 1-> print_endline "Usage: rhast <script>"; exit 64 | len when len = 1 -> run_file args.(1) | _ -> run_repl
  

