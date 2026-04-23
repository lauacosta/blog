let run_file file =
  print_endline file

let run_repl =
  print_endline "REPL is _todo_"

let () =
  let args = Sys.argv  in
  match Array.length args with
  len when len > 1-> print_endline "Usage: rhast <script>"; exit 64 | len when len == 1 -> run_file args.(1) | _ -> run_repl
  

